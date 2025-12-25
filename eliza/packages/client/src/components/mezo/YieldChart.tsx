import * as React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const data = [
    { name: 'Day 1', yield: 4.2 },
    { name: 'Day 2', yield: 4.3 },
    { name: 'Day 3', yield: 4.8 },
    { name: 'Day 4', yield: 5.1 },
    { name: 'Day 5', yield: 4.9 },
    { name: 'Day 6', yield: 5.4 },
    { name: 'Day 7', yield: 6.2 },
];

export function YieldChart() {
    return (
        <div className="h-[250px] w-full bg-black/80 border border-green-900/50 rounded-md p-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-mono text-green-500 font-bold">/// YIELD_METRICS_BTC</h3>
                <span className="text-xs font-mono text-green-700">Upshift Vault: Delta Neutral</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#14532d" vertical={false} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#052e16', borderColor: '#15803d', color: '#4ade80' }}
                        itemStyle={{ color: '#4ade80' }}
                        labelStyle={{ display: 'none' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="yield"
                        stroke="#22c55e"
                        fillOpacity={1}
                        fill="url(#colorYield)"
                    />
                </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-between mt-2 text-xs font-mono text-green-800">
                <span>-7D</span>
                <span>NOW</span>
            </div>
        </div>
    );
}
