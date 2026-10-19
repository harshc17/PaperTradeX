/**
 * BaseModel.js — Redis-primary active-record layer with best-effort Mongo mirror.
 *
 * Reproduces the exact subset of the Mongoose API that server.js and
 * TradeEngine.js rely on, so no consumer code changes:
 *
 *   Statics:  Model.create(obj), new Model(obj), Model.findById(id),
 *             Model.findOne(query), Model.find(query)
 *   Chaining: .sort({field:-1}), .limit(n), .lean()   (thenable query builder)
 *   Operators in queries: equality, $in, $gt
 *   Documents: doc.save(), doc.deleteOne(), doc.toObject()
 *              (save/deleteOne/toObject are NON-enumerable so res.json() stays clean)
 *
 * Storage model (prefix `prtx:`):
 *   - Each document is a STRING holding JSON.stringify(doc), at prtx:<prefix>:<id>
 *   - Secondary indexes (built from each model's config) answer the read queries:
 *       unique → STRING key → id          (findOne by that field; uniqueness)
 *       set    → SET of ids               (unsorted find by field)
 *       zset   → SORTED SET scored by createdAt ms  (find + sort({createdAt:-1}))
 *
 * Identity: ids are minted as `new ObjectId().toString()` so the Redis key and
 * the Mongo `_id` are the same 24-hex value — the two stores share identity.
 *
 * Dual-write: writes go to Redis (atomic MULTI over doc + its indexes), then a
 * fire-and-forget mirror into Mongo. If Redis is fully unreachable, reads and
 * writes fall back to Mongo directly.
 */
const { client, redisUp } = require('./redisClient');
const mongoBackup = require('./mongoBackup');
const { mongoUp, backupWrite, backupDelete, toObjectId, models: mongoModels, mongoose } = mongoBackup;

const KEY = 'prtx';

// ── small helpers ────────────────────────────────────────────────────────────
function newId() {
    return new mongoose.Types.ObjectId().toString();
}

function toMs(x) {
    if (x == null) return NaN;
    return x instanceof Date ? x.getTime() : new Date(x).getTime();
}

function looseEq(a, b) {
    if (b === null) return a === null || a === undefined;
    if (a instanceof Date || b instanceof Date) return toMs(a) === toMs(b);
    return String(a) === String(b);
}

/** Match a stored doc against a query supporting equality, $in and $gt. */
function matchQuery(doc, query) {
    for (const [k, cond] of Object.entries(query)) {
        const val = doc[k];
        if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
            if ('$in' in cond) {
                const set = cond.$in.map(String);
                if (!set.includes(String(val))) return false;
            }
            if ('$gt' in cond) {
                if (!(toMs(val) > toMs(cond.$gt))) return false;
            }
        } else if (!looseEq(val, cond)) {
            return false;
        }
    }
    return true;
}

function sortDocs(docs, spec) {
    const entries = Object.entries(spec);
    return docs.slice().sort((a, b) => {
        for (const [field, dir] of entries) {
            const av = a[field], bv = b[field];
            const an = av instanceof Date ? av.getTime() : av;
            const bn = bv instanceof Date ? bv.getTime() : bv;
            if (an < bn) return dir === -1 ? 1 : -1;
            if (an > bn) return dir === -1 ? -1 : 1;
        }
        return 0;
    });
}

// ── Query builder (thenable; supports sort/limit/lean) ───────────────────────
class Query {
    constructor(model, query, mode, id) {
        this._model = model;
        this._query = query || {};
        this._mode = mode;      // 'one' | 'many' | 'byId'
        this._id = id;
        this._sort = null;
        this._limit = null;
        this._lean = false;
    }
    sort(spec) { this._sort = spec; return this; }
    limit(n) { this._limit = n; return this; }
    lean() { this._lean = true; return this; }

    then(resolve, reject) {
        return this._exec().then(resolve, reject);
    }
    catch(reject) { return this.then(undefined, reject); }

    async _exec() {
        if (redisUp()) {
            try {
                return await this._model._execRedis(this);
            } catch (err) {
                if (!mongoUp()) throw err;
                console.warn(`[DB] Redis read failed, falling back to Mongo:`, err.message);
            }
        }
        if (mongoUp()) return this._model._execMongo(this);
        throw new Error('No datastore available (Redis and Mongo both down)');
    }
}

// ── Model factory ─────────────────────────────────────────────────────────────
function defineModel(config) {
    const {
        name,
        prefix,
        dateFields = [],
        defaults = {},
        indexes = [],
        queryIndexes = [],
        preSave = null,
    } = config;

    const docKey = (id) => `${KEY}:${prefix}:${id}`;

    // Newable constructor that RETURNS a plain doc object (overrides `this`).
    function Model(data = {}) {
        return makeNewDoc(data);
    }
    Model._config = config;

    // ── document construction ────────────────────────────────────────────────
    function attachMethods(doc) {
        Object.defineProperty(doc, 'save', {
            value: function () { return Model._persist(this); },
            enumerable: false, writable: true, configurable: true,
        });
        Object.defineProperty(doc, 'deleteOne', {
            value: function () { return Model._delete(this); },
            enumerable: false, writable: true, configurable: true,
        });
        Object.defineProperty(doc, 'toObject', {
            value: function () { return { ...this }; },
            enumerable: false, writable: true, configurable: true,
        });
        return doc;
    }

    function makeNewDoc(data) {
        const doc = {};
        for (const [k, v] of Object.entries(defaults)) {
            doc[k] = typeof v === 'function' ? v() : v;
        }
        for (const [k, v] of Object.entries(data)) {
            if (v !== undefined) doc[k] = v;
        }
        return attachMethods(doc);
    }

    function wrapDoc(plain) {
        return attachMethods(Object.assign({}, plain));
    }

    function parse(raw) {
        const o = JSON.parse(raw);
        for (const f of dateFields) if (o[f] != null) o[f] = new Date(o[f]);
        return o;
    }

    // ── index entries for a plain doc ────────────────────────────────────────
    function indexEntries(plain) {
        const entries = [];
        for (const idx of indexes) {
            if (idx.when && !idx.when(plain)) continue;
            const key = idx.key(plain);
            if (key == null || key.endsWith(':undefined') || key.endsWith(':null')) continue;
            if (idx.kind === 'zset') {
                entries.push({ kind: 'zset', key, member: plain._id, score: idx.score(plain) });
            } else if (idx.kind === 'set') {
                entries.push({ kind: 'set', key, member: plain._id });
            } else {
                entries.push({ kind: 'unique', key });
            }
        }
        return entries;
    }
    const entryId = (e) => `${e.kind}|${e.key}`;

    // ── next sequence (order id counter) ─────────────────────────────────────
    Model._nextSeq = async function (counterName) {
        if (redisUp()) return client.incr(`${KEY}:counter:${counterName}`);
        if (mongoUp()) {
            const doc = await mongoModels.Counter.findByIdAndUpdate(
                counterName, { $inc: { seq: 1 } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            return doc.seq;
        }
        throw new Error('No datastore available to allocate sequence');
    };

    // ── persist (create + save) ──────────────────────────────────────────────
    Model._persist = async function (doc) {
        if (redisUp()) {
            try {
                return await persistRedis(doc);
            } catch (err) {
                if (!mongoUp()) throw err;
                console.warn(`[DB] Redis write failed, falling back to Mongo:`, err.message);
            }
        }
        if (mongoUp()) return persistMongo(doc);
        throw new Error('No datastore available (Redis and Mongo both down)');
    };

    async function persistRedis(doc) {
        if (preSave) await preSave(doc, Model);

        const isNew = !doc._id;
        if (isNew) doc._id = newId();
        const now = new Date();
        if (isNew && !doc.createdAt) doc.createdAt = now;
        doc.updatedAt = now;

        const plain = { ...doc };                 // enumerable data only (no methods)
        const key = docKey(plain._id);

        // Diff against previously-stored version so index moves are handled.
        const oldRaw = await client.get(key);
        const oldEntries = oldRaw ? indexEntries(parse(oldRaw)) : [];
        const newEntries = indexEntries(plain);

        // Best-effort uniqueness guard (parity with Mongoose unique index).
        for (const e of newEntries) {
            if (e.kind !== 'unique') continue;
            if (oldEntries.some((o) => entryId(o) === entryId(e))) continue;
            const holder = await client.get(e.key);
            if (holder && holder !== plain._id) {
                const err = new Error(`E11000 duplicate key error: ${e.key}`);
                err.code = 11000;
                throw err;
            }
        }

        const newIds = new Set(newEntries.map(entryId));
        const multi = client.multi();
        for (const e of oldEntries) {
            if (newIds.has(entryId(e))) continue;
            if (e.kind === 'unique') multi.del(e.key);
            else if (e.kind === 'set') multi.sRem(e.key, e.member);
            else multi.zRem(e.key, e.member);
        }
        for (const e of newEntries) {
            if (e.kind === 'unique') multi.set(e.key, plain._id);
            else if (e.kind === 'set') multi.sAdd(e.key, e.member);
            else multi.zAdd(e.key, { score: e.score, value: e.member });
        }
        multi.set(key, JSON.stringify(plain));
        await multi.exec();

        // Fire-and-forget Mongo mirror — never awaited, never throws into caller.
        backupWrite(name, plain._id, plain);
        return doc;
    }

    async function persistMongo(doc) {
        if (preSave) await preSave(doc, Model);
        const isNew = !doc._id;
        if (isNew) doc._id = newId();
        const now = new Date();
        if (isNew && !doc.createdAt) doc.createdAt = now;
        doc.updatedAt = now;
        const { _id, ...rest } = { ...doc };
        await mongoModels[name].updateOne({ _id: toObjectId(_id) }, { $set: rest }, { upsert: true, timestamps: false });
        return doc;
    }

    // ── delete ───────────────────────────────────────────────────────────────
    Model._delete = async function (doc) {
        if (redisUp()) {
            try { return await deleteRedis(doc); }
            catch (err) {
                if (!mongoUp()) throw err;
                console.warn('[DB] Redis delete failed, falling back to Mongo:', err.message);
            }
        }
        if (mongoUp()) { await mongoModels[name].deleteOne({ _id: toObjectId(doc._id) }); return { deletedCount: 1 }; }
        throw new Error('No datastore available (Redis and Mongo both down)');
    };

    async function deleteRedis(doc) {
        const plain = { ...doc };
        const key = docKey(plain._id);
        const entries = indexEntries(plain);
        const multi = client.multi();
        for (const e of entries) {
            if (e.kind === 'unique') multi.del(e.key);
            else if (e.kind === 'set') multi.sRem(e.key, e.member);
            else multi.zRem(e.key, e.member);
        }
        multi.del(key);
        await multi.exec();
        backupDelete(name, plain._id);
        return { deletedCount: 1 };
    }

    // ── read execution (Redis) ───────────────────────────────────────────────
    function pickIndex(query) {
        for (const idx of queryIndexes) {
            if (idx.fields.every((f) => query[f] !== undefined) && (!idx.when || idx.when(query))) {
                return idx;
            }
        }
        return null;
    }

    Model._execRedis = async function (qb) {
        const q = qb._query;
        let ids;

        if (qb._mode === 'byId') {
            ids = qb._id != null ? [String(qb._id)] : [];
        } else if (q._id != null) {
            ids = [String(q._id)];
        } else {
            const idx = pickIndex(q);
            if (!idx) throw new Error(`No Redis index for ${name} query fields: ${Object.keys(q).join(',')}`);
            const ikey = idx.key(q);
            if (idx.kind === 'unique') {
                const id = await client.get(ikey);
                ids = id ? [id] : [];
            } else if (idx.kind === 'set') {
                ids = await client.sMembers(ikey);
            } else {
                ids = await client.zRange(ikey, 0, -1, { REV: true }); // newest first
            }
        }

        if (!ids.length) return qb._mode === 'many' ? [] : null;

        const raws = await client.mGet(ids.map(docKey));
        let docs = [];
        for (const raw of raws) if (raw) docs.push(parse(raw));

        docs = docs.filter((d) => matchQuery(d, q));
        if (qb._sort) docs = sortDocs(docs, qb._sort);
        if (qb._limit != null) docs = docs.slice(0, qb._limit);

        const out = docs.map((d) => (qb._lean ? d : wrapDoc(d)));
        return qb._mode === 'many' ? out : (out[0] || null);
    };

    // ── read execution (Mongo fallback) ──────────────────────────────────────
    Model._execMongo = async function (qb) {
        const M = mongoModels[name];
        const q = { ...qb._query };
        if (qb._mode === 'byId') q._id = qb._id;
        if (q._id != null) q._id = toObjectId(q._id);

        let cursor = M.find(q);
        if (qb._sort) cursor = cursor.sort(qb._sort);
        if (qb._limit != null) cursor = cursor.limit(qb._limit);
        const rows = await cursor.lean();

        const norm = rows.map((r) => {
            r._id = String(r._id);
            for (const f of ['user', 'challenge']) if (r[f] != null) r[f] = String(r[f]);
            return r;
        });
        const out = norm.map((d) => (qb._lean ? d : wrapDoc(d)));
        return qb._mode === 'many' ? out : (out[0] || null);
    };

    // ── public statics ───────────────────────────────────────────────────────
    Model.create = function (data) {
        return makeNewDoc(data).save();
    };
    Model.findById = function (id) {
        return new Query(Model, {}, 'byId', id);
    };
    Model.findOne = function (query) {
        return new Query(Model, query, 'one');
    };
    Model.find = function (query) {
        return new Query(Model, query || {}, 'many');
    };

    return Model;
}

module.exports = { defineModel };
