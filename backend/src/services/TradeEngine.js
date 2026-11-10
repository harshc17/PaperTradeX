const { User, Portfolio, TransactionHistory, Order } = require('../models');
const NSEClient = require('./NSEClient');
const mongoose = require('mongoose');
const { assertTradable } = require('./MarketIndex');

class TradeEngine {
    /**
     * Execute a trade (BUY/SELL) for a user.
     * For LIMIT orders: registers the order as OPEN and returns. Execution happens via processMarketTick.
     * For MARKET orders: immediately deducts/credits balance and updates portfolio.
     */
    /**
     * Helper to apply trade execution: deducts/credits balance, upserts/removes portfolio holding,
     * and records transaction history.
     */
    async _applyTradeExecution(user, type, bare, qty, price, totalAmount, session) {
        assertTradable(bare);
        this.assertMarketOpen();
        if (type === 'BUY') {
            if (user.balance < totalAmount) {
                throw new Error(
                    `Insufficient balance. Required: ₹${totalAmount.toFixed(2)}, Available: ₹${user.balance.toFixed(2)}`
                );
            }

            user.balance = parseFloat((user.balance - totalAmount).toFixed(2));
            await user.save();

            // Upsert portfolio position
            const position = await Portfolio.findOne({ user: user._id, symbol: bare }).session(session);
            if (position) {
                const totalCost = (position.quantity * position.averagePrice) + totalAmount;
                position.quantity += qty;
                position.averagePrice = parseFloat((totalCost / position.quantity).toFixed(4));
                await position.save();
            } else {
                await Portfolio.create([{ user: user._id, symbol: bare, quantity: qty, averagePrice: price }], { session });
            }
        } else if (type === 'SELL') {
            const position = await Portfolio.findOne({ user: user._id, symbol: bare }).session(session);
            if (!position) throw new Error(`You don't hold any ${bare} shares`);
            if (position.quantity < qty) {
                throw new Error(
                    `Insufficient holdings. You have ${position.quantity} share(s) of ${bare}, trying to sell ${qty}`
                );
            }

            position.quantity -= qty;
            if (position.quantity === 0) {
                await position.deleteOne();
            } else {
                await position.save();
            }

            user.balance = parseFloat((user.balance + totalAmount).toFixed(2));
            await user.save();
        }

        // Record transaction
        await TransactionHistory.create([{
            user: user._id,
            type,
            symbol: bare,
            quantity: qty,
            price,
            totalAmount,
        }], { session });
    }

    /**
     * Execute a trade (BUY/SELL) for a user.
     * Paper orders execute only during the regular trading session.
     * For LIMIT orders:
     *   - If limit price is marketable (BUY with limitPrice >= currentPrice, or SELL with limitPrice <= currentPrice),
     *     it executes immediately.
     *   - Otherwise, it registers as OPEN to fill when price targets are hit.
     * For MARKET orders:
     *   - Immediately updates balance, portfolio, and transaction history.
     */
    assertMarketOpen() {
        const status = NSEClient.getMarketStatus();
        if (!status.isOpen) {
            throw new Error(`Market closed. Trading resumes ${status.nextOpenFormatted}. Orders are accepted only during regular market hours.`);
        }
    }

    async executeTrade(userId, type, symbol, quantity, currentPrice, orderType = 'MARKET', limitPrice = null) {
        assertTradable(symbol);
        this.assertMarketOpen();
        return mongoose.connection.transaction(session =>
            this._executeTrade(userId, type, symbol, quantity, currentPrice, orderType, limitPrice, session));
    }

    async _executeTrade(userId, type, symbol, quantity, currentPrice, orderType, limitPrice, session) {
        this.assertMarketOpen();
        // ── Input Validation ────────────────────────────────────────────────────
        const user = await User.findById(userId).session(session);
        if (!user) throw new Error('User not found');

        const qty = Number(quantity);
        if (!Number.isSafeInteger(qty) || qty <= 0 || !['number', 'string'].includes(typeof quantity)) {
            throw new Error('Quantity must be a positive whole number');
        }

        const price = Number(currentPrice);
        if (!Number.isFinite(price) || price <= 0) {
            throw new Error('Price must be greater than zero');
        }

        if (!['BUY', 'SELL'].includes(type)) {
            throw new Error('Order side must be BUY or SELL');
        }

        if (!['MARKET', 'LIMIT'].includes(orderType)) {
            throw new Error('Order type must be MARKET or LIMIT');
        }

        if (!symbol || typeof symbol !== 'string') {
            throw new Error('Symbol is required');
        }

        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();

        // ── LIMIT Order ────────────────────────────────────────────────────────
        if (orderType === 'LIMIT') {
            const lp = Number(limitPrice);
            if (!Number.isFinite(lp) || lp <= 0) {
                throw new Error('Limit price must be greater than zero for LIMIT orders');
            }

            // Check if marketable (immediately fillable):
            // BUY fills if limitPrice >= current price
            // SELL fills if limitPrice <= current price
            const isMarketable = (type === 'BUY' && lp >= price) || (type === 'SELL' && lp <= price);

            if (isMarketable) {
                const execPrice = price;
                const totalAmount = parseFloat((qty * execPrice).toFixed(2));

                await this._applyTradeExecution(user, type, bare, qty, execPrice, totalAmount, session);

                const order = new Order({
                    user:        userId,
                    symbol:      bare,
                    side:        type,
                    quantity:    qty,
                    orderType:   'LIMIT',
                    limitPrice:  lp,
                    price:       execPrice,
                    totalAmount,
                    status:      'FILLED',
                });
                await order.save({ session });

                return { success: true, orderId: order.orderId, status: 'FILLED', newBalance: user.balance, price: execPrice };
            }

            // Queued limit order
            const order = new Order({
                user:      userId,
                symbol:    bare,
                side:      type,
                quantity:  qty,
                orderType,
                limitPrice: lp,
                status:    'OPEN',
            });
            await order.save({ session }); // pre-save hook assigns orderId (L-N)

            return { success: true, orderId: order.orderId, status: order.status };
        }

        // ── MARKET Order: execute immediately ──────────────────────────────────
        const totalAmount = parseFloat((qty * price).toFixed(2));
        await this._applyTradeExecution(user, type, bare, qty, price, totalAmount, session);

        // Save completed MARKET order for history
        const order = new Order({
            user:        userId,
            symbol:      bare,
            side:        type,
            quantity:    qty,
            orderType:   'MARKET',
            price,
            totalAmount,
            status:      'FILLED',
        });
        await order.save({ session });

        return { success: true, orderId: order.orderId, status: 'FILLED', newBalance: user.balance, price };
    }

    /**
     * Get all portfolio positions for a user.
     */
    async getPortfolio(userId) {
        return await Portfolio.find({ user: userId });
    }

    /**
     * Cancel an OPEN limit order. Only the order owner can cancel it.
     */
    async cancelOrder(orderId, userId) {
        // Accept either the readable orderId ('L-5') or MongoDB _id string
        const query = orderId.match(/^[LM]-\d+$/)
            ? { orderId, user: userId }
            : { _id: orderId, user: userId };

        const order = await Order.findOneAndUpdate({ ...query, status: 'OPEN' }, { $set: { status: 'CANCELLED' } }, { returnDocument: 'after' });
        if (!order) throw new Error('Order not found');
        return { success: true, orderId: order.orderId, status: order.status };
    }

    /**
     * Called on each price tick to fill any eligible OPEN limit orders.
     * BUY limit fills when price drops to or below limitPrice.
     * SELL limit fills when price rises to or above limitPrice.
     */
    async processMarketTick(symbol, currentPrice) {
        if (!NSEClient.isMarketHours()) return;
        if (!Number.isFinite(currentPrice) || currentPrice <= 0) return;
        const bare = symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();

        const openOrders = await Order.find({ symbol: bare, status: 'OPEN' });

        for (const order of openOrders) {
            if (!NSEClient.isMarketHours()) return;
            const shouldFill =
                (order.side === 'BUY'  && currentPrice <= order.limitPrice) ||
                (order.side === 'SELL' && currentPrice >= order.limitPrice);

            if (!shouldFill) continue;

            try {
                await mongoose.connection.transaction(async session => {
                    const pending = await Order.findOne({ _id: order._id, status: 'OPEN' }).session(session);
                    if (!pending) return;
                    const user = await User.findById(pending.user).session(session);
                    if (!user) return;
                    const totalAmount = parseFloat((pending.quantity * currentPrice).toFixed(2));
                    await this._applyTradeExecution(user, pending.side, pending.symbol, pending.quantity, currentPrice, totalAmount, session);
                    pending.status = 'FILLED';
                    pending.price = currentPrice;
                    pending.totalAmount = totalAmount;
                    await pending.save();
                });
                console.log(`[TradeEngine] Limit order ${order.orderId} filled: ${order.side} ${order.quantity}x ${order.symbol} @ ₹${currentPrice}`);
            } catch (e) {
                console.error(`[TradeEngine] Failed to fill limit order ${order.orderId}:`, e.message);
            }
        }
    }
}

module.exports = new TradeEngine();
