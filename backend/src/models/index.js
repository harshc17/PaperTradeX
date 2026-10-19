/**
 * models/index.js — Primary MongoDB data-access API via Mongoose.
 *
 * Exposes the standard models and database helpers used by server.js
 * and TradeEngine.js:
 *   - connectDB
 *   - User
 *   - Portfolio
 *   - TransactionHistory
 *   - Order
 *   - WeeklyChallenge
 *   - WeeklyChallengeTrade
 *   - seedAdmin
 *   - redisUp (legacy compatibility shim)
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/papertradex';

// ── 1. Schemas ────────────────────────────────────────────────────────────────

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

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

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
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ symbol: 1, status: 1 });

orderSchema.pre('save', async function () {
    if (!this.orderId) {
        const prefix = this.orderType === 'LIMIT' ? 'L' : 'M';
        const counter = await Counter.findByIdAndUpdate(
            `order_${prefix}`,
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        this.orderId = `${prefix}-${counter.seq}`;
    }
});

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
weeklyChallengeSchema.index({ user: 1, status: 1 });
weeklyChallengeSchema.index({ user: 1, createdAt: -1 });

const weeklyChallengeTradeSchema = new mongoose.Schema({
    challenge:   { type: mongoose.Schema.Types.ObjectId, ref: 'WeeklyChallenge', required: true },
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type:        { type: String, enum: ['BUY', 'SELL'], required: true },
    symbol:      { type: String, required: true },
    quantity:    { type: Number, required: true },
    price:       { type: Number, required: true },
    totalAmount: { type: Number, required: true },
}, { timestamps: true });
weeklyChallengeTradeSchema.index({ challenge: 1, createdAt: -1 });

// ── 2. Models ─────────────────────────────────────────────────────────────────

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Portfolio = mongoose.models.Portfolio || mongoose.model('Portfolio', portfolioSchema);
const TransactionHistory = mongoose.models.TransactionHistory || mongoose.model('TransactionHistory', transactionHistorySchema);
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
const WeeklyChallenge = mongoose.models.WeeklyChallenge || mongoose.model('WeeklyChallenge', weeklyChallengeSchema);
const WeeklyChallengeTrade = mongoose.models.WeeklyChallengeTrade || mongoose.model('WeeklyChallengeTrade', weeklyChallengeTradeSchema);

// ── 3. Database Bootstrap ─────────────────────────────────────────────────────

async function connectDB() {
    try {
        mongoose.connection.on('disconnected', () => {
            console.warn('[MongoDB] Disconnected from database');
        });
        mongoose.connection.on('reconnected', () => {
            console.log('[MongoDB] Reconnected to database');
        });
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        const safeUri = MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@');
        console.log(`[MongoDB] Connected successfully to ${safeUri} ✓`);
    } catch (err) {
        console.error('[MongoDB] Connection error:', err.message);
        throw err;
    }
}

// ── 4. Admin Seed ─────────────────────────────────────────────────────────────

async function seedAdmin() {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@papertradex.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        console.log('[MongoDB] ADMIN_PASSWORD not set — skipping admin seed.');
        return;
    }

    try {
        const existing = await User.findOne({ email: adminEmail });
        if (!existing) {
            const hash = await bcrypt.hash(adminPassword, 12);
            await User.create({
                name: 'Harsh Admin',
                email: adminEmail,
                phone: '0000000000',
                password_hash: hash,
                role: 'ADMIN',
                balance: 100000,
            });
            console.log('[MongoDB] Admin user seeded ✓');
        }
    } catch (err) {
        console.warn('[MongoDB] Admin seed failed:', err.message);
    }
}

module.exports = {
    connectDB,
    User,
    Portfolio,
    TransactionHistory,
    Order,
    WeeklyChallenge,
    WeeklyChallengeTrade,
    Counter,
    seedAdmin,
    redisUp: () => false,
};
