/**
 * mongoBackup.js — Best-effort MongoDB backup + failover store.
 *
 * MongoDB is NOT the primary datastore anymore; Redis is. This module keeps a
 * live mirror of every write and doubles as the read/write store if Redis is
 * fully unreachable. It must never take the app down: if Mongo can't be
 * reached, the app keeps running on Redis alone and we just log a warning.
 *
 * These are the original schemas, moved here verbatim so the Mongo copy stays
 * shape-compatible with the pre-Redis database.
 */
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/papertradex';

let mongoReady = false;

// ── Schemas (unchanged from the original models/index.js) ────────────────────
const userSchema = new mongoose.Schema({
    name:          { type: String, required: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:         { type: String, default: '' },
    password_hash: { type: String, default: null },
    googleId:      { type: String, default: null, index: true },
    authProvider:  { type: String, enum: ['local', 'google'], default: 'local' },
    resetPasswordToken:   { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    role:          { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    balance:       { type: Number, default: 100000 },
}, { timestamps: true });

const portfolioSchema = new mongoose.Schema({
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    symbol:       { type: String, required: true },
    quantity:     { type: Number, required: true },
    averagePrice: { type: Number, required: true },
}, { timestamps: true });
portfolioSchema.index({ user: 1, symbol: 1 }, { unique: true });

const transactionHistorySchema = new mongoose.Schema({
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type:        { type: String, enum: ['BUY', 'SELL'], required: true },
    symbol:      { type: String, required: true },
    quantity:    { type: Number, required: true },
    price:       { type: Number, required: true },
    totalAmount: { type: Number, required: true },
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
    orderId:     { type: String, unique: true, sparse: true },
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    symbol:      { type: String, required: true },
    side:        { type: String, enum: ['BUY', 'SELL'], required: true },
    quantity:    { type: Number, required: true },
    orderType:   { type: String, enum: ['MARKET', 'LIMIT'], required: true, default: 'MARKET' },
    limitPrice:  { type: Number, default: null },
    price:       { type: Number, default: null },
    totalAmount: { type: Number, default: null },
    status:      { type: String, enum: ['OPEN', 'FILLED', 'CANCELLED'], default: 'OPEN' },
}, { timestamps: true });

const weeklyChallengePositionSchema = new mongoose.Schema({
    symbol:       { type: String, required: true },
    quantity:     { type: Number, required: true, min: 0 },
    averagePrice: { type: Number, required: true, min: 0 },
}, { _id: false });

const weeklyChallengeSchema = new mongoose.Schema({
    user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:         { type: String, enum: ['ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED'], default: 'ACTIVE' },
    initialBalance: { type: Number, default: 10000 },
    targetBalance:  { type: Number, default: 15000 },
    cashBalance:    { type: Number, default: 10000 },
    positions:      { type: [weeklyChallengePositionSchema], default: [] },
    startAt:        { type: Date, required: true },
    endAt:          { type: Date, required: true },
    completedAt:    { type: Date, default: null },
}, { timestamps: true });

const weeklyChallengeTradeSchema = new mongoose.Schema({
    challenge:   { type: mongoose.Schema.Types.ObjectId, ref: 'WeeklyChallenge', required: true },
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type:        { type: String, enum: ['BUY', 'SELL'], required: true },
    symbol:      { type: String, required: true },
    quantity:    { type: Number, required: true },
    price:       { type: Number, required: true },
    totalAmount: { type: Number, required: true },
}, { timestamps: true });

// Counter — only used to allocate order ids when Redis is down (fallback path).
const counterSchema = new mongoose.Schema({
    _id: String,
    seq: { type: Number, default: 0 },
});

const models = {
    User:                  mongoose.model('User', userSchema),
    Portfolio:             mongoose.model('Portfolio', portfolioSchema),
    TransactionHistory:    mongoose.model('TransactionHistory', transactionHistorySchema),
    Order:                 mongoose.model('Order', orderSchema),
    WeeklyChallenge:       mongoose.model('WeeklyChallenge', weeklyChallengeSchema),
    WeeklyChallengeTrade:  mongoose.model('WeeklyChallengeTrade', weeklyChallengeTradeSchema),
    Counter:               mongoose.model('Counter', counterSchema),
};

// ── Connection (best-effort — never fatal) ───────────────────────────────────
async function connectMongoBackup() {
    try {
        mongoose.connection.on('disconnected', () => { mongoReady = false; });
        mongoose.connection.on('reconnected', () => { mongoReady = true; });
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        mongoReady = true;
        console.log('[MongoBackup] Connected ✓ (backup mirror)');
    } catch (err) {
        mongoReady = false;
        console.warn('[MongoBackup] Unavailable — continuing on Redis alone:', err.message);
    }
}

function mongoUp() {
    return mongoReady && mongoose.connection.readyState === 1;
}

/** Cast a canonical 24-hex id string to an ObjectId (shared identity with Redis). */
function toObjectId(id) {
    try { return new mongoose.Types.ObjectId(id); }
    catch { return id; }
}

/**
 * Mirror a document into Mongo, keyed by the shared _id. Fire-and-forget:
 * callers do NOT await this on the Redis-primary path, so a slow or dead Mongo
 * never adds latency or throws into a request.
 */
function backupWrite(modelName, id, data) {
    const Model = models[modelName];
    if (!Model || !mongoUp()) return Promise.resolve();
    const { _id, ...rest } = data;
    return Model.updateOne(
        { _id: toObjectId(id) },
        { $set: rest },
        { upsert: true, timestamps: false }   // we supply createdAt/updatedAt ourselves
    ).catch((e) => console.warn(`[MongoBackup] ${modelName} write failed:`, e.message));
}

function backupDelete(modelName, id) {
    const Model = models[modelName];
    if (!Model || !mongoUp()) return Promise.resolve();
    return Model.deleteOne({ _id: toObjectId(id) })
        .catch((e) => console.warn(`[MongoBackup] ${modelName} delete failed:`, e.message));
}

module.exports = {
    models,
    connectMongoBackup,
    mongoUp,
    toObjectId,
    backupWrite,
    backupDelete,
    mongoose,
};
