'use client';
import { useHoldings } from '@/context/HoldingsContext';

export default function OrdersList() {
    const { orders } = useHoldings();

    if (orders.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-surface-2 dark:bg-surface-2 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">📝</span>
                </div>
                <h3 className="text-lg font-medium text-ink dark:text-ink mb-2">No orders placed</h3>
                <p className="text-ink-muted dark:text-ink-faint max-w-sm">
                    Trades you make will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="py-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-ink dark:text-ink">Orders ({orders.length})</h2>
            </div>

            <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-surface-2 dark:bg-surface-2/50 border-b border-line dark:border-line text-xs font-medium text-ink-muted dark:text-ink-faint">
                            <th className="px-6 py-4 font-medium">Time</th>
                            <th className="px-6 py-4 font-medium">Type</th>
                            <th className="px-6 py-4 font-medium">Instrument</th>
                            <th className="px-6 py-4 font-medium text-right">Qty.</th>
                            <th className="px-6 py-4 font-medium text-right">Average price</th>
                            <th className="px-6 py-4 font-medium text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {orders.map((order) => {
                            return (
                                <tr key={order.id} className="hover:bg-surface-2 dark:hover:bg-surface-2/30 transition-colors">
                                    <td className="px-6 py-4 text-xs text-ink-muted dark:text-ink-faint">
                                        {order.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        <div className="text-xs">{order.timestamp.toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium  ${order.type === 'BUY' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {order.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-ink dark:text-ink">{order.name}</div>
                                        <div className="text-xs text-ink-faint">{order.symbol}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-ink dark:text-ink">
                                        {order.qty}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-ink dark:text-ink">
                                        ₹{order.price.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                            <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                                {order.status}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
