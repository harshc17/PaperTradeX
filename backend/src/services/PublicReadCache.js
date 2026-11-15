class PublicReadCache {
    constructor(limit = 128) { this.limit = limit; this.entries = new Map(); this.pending = new Map(); }
    async load(key, ttl, read, valid = Boolean) {
        const entry = this.entries.get(key);
        if (entry && entry.expires > Date.now()) return entry.value;
        if (this.pending.has(key)) return this.pending.get(key);
        const request = Promise.resolve().then(read).then(value => {
            if (valid(value)) {
                this.entries.delete(key);
                this.entries.set(key, { value, expires: Date.now() + ttl });
                while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value);
            }
            return value;
        }).finally(() => this.pending.delete(key));
        this.pending.set(key, request);
        return request;
    }
}
module.exports = PublicReadCache;
