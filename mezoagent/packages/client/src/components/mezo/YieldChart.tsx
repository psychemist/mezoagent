// @ts-nocheck
import * as React from 'react';
import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface YieldDataPoint {
    timestamp: number;
    date: string;
    yield: number;
    apy?: number;
    tvl?: number;
}

interface YieldChartProps {
    data?: YieldDataPoint[];
    vaultName?: string;
    strategy?: string;
    className?: string;
    onTimeRangeChange?: (range: string) => void;
}

const generateMockData = (days: number): YieldDataPoint[] => {
    const data: YieldDataPoint[] = [];
    const now = Date.now();
    const baseYield = 4.2;

    for (let i = days; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const variance = (Math.random() - 0.5) * 2;
        const yieldValue = baseYield + variance + (days - i) * 0.1;

        data.push({
            timestamp: date.getTime(),
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            yield: Math.max(0, yieldValue),
            apy: yieldValue * 1.2,
            tvl: 450000000 + Math.random() * 10000000
        });
    }

    return data;
};

const TIME_RANGES = [
    { value: '7d', label: '7D', days: 7 },
    { value: '30d', label: '30D', days: 30 },
    { value: '90d', label: '90D', days: 90 },
    { value: '1y', label: '1Y', days: 365 }
];

export function YieldChart({
    data: externalData,
    vaultName = "Upshift Vault: Delta Neutral",
    strategy = "Delta Neutral BTC",
    className,
    onTimeRangeChange
}: YieldChartProps) {
    const [timeRange, setTimeRange] = useState('7d');
    const [hoveredPoint, setHoveredPoint] = useState<YieldDataPoint | null>(null);

    const rangeConfig = TIME_RANGES.find(r => r.value === timeRange) || TIME_RANGES[0];
    const data = useMemo(() => {
        return externalData || generateMockData(rangeConfig.days);
    }, [externalData, rangeConfig.days]);

    const currentYield = hoveredPoint?.yield || data[data.length - 1]?.yield || 0;
    const previousYield = data.length > 1 ? data[data.length - 2]?.yield || 0 : currentYield;
    const yieldChange = currentYield - previousYield;
    const yieldChangePercent = previousYield > 0 ? ((yieldChange / previousYield) * 100) : 0;

    const handleTimeRangeChange = (value: string) => {
        setTimeRange(value);
        onTimeRangeChange?.(value);
    };

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload as YieldDataPoint;
            setHoveredPoint(data);
            return (
                <div className="bg-black/95 border border-green-900/50 rounded-md p-3 shadow-xl font-mono text-xs">
                    <div className="text-green-400 mb-2">{data.date}</div>
                    <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                            <span className="text-green-700">Yield:</span>
                            <span className="text-green-400 font-bold">{data.yield.toFixed(2)}%</span>
                        </div>
                        {data.apy !== undefined && (
                            <div className="flex justify-between gap-4">
                                <span className="text-green-700">APY:</span>
                                <span className="text-green-400">{data.apy.toFixed(2)}%</span>
                            </div>
                        )}
                        {data.tvl !== undefined && (
                            <div className="flex justify-between gap-4">
                                <span className="text-green-700">TVL:</span>
                                <span className="text-green-400">${(data.tvl / 1000000).toFixed(1)}M</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        setHoveredPoint(null);
        return null;
    };

    return (
        <div className={cn("h-[280px] w-full bg-black/80 border border-green-900/50 rounded-md p-4 shadow-xl", className)}>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-sm font-mono text-green-500 font-bold mb-1">/// YIELD_METRICS_BTC</h3>
                    <span className="text-xs font-mono text-green-700">{vaultName}</span>
                </div>
                <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                    <SelectTrigger className="h-7 w-20 text-xs bg-black/50 border-green-900/50 text-green-400">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-green-900/50">
                        {TIME_RANGES.map(range => (
                            <SelectItem
                                key={range.value}
                                value={range.value}
                                className="text-green-400 focus:text-green-300"
                            >
                                {range.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="mb-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-mono font-bold text-green-400">
                        {currentYield.toFixed(2)}%
                    </span>
                    {yieldChange !== 0 && (
                        <div className={cn(
                            "flex items-center gap-1 text-xs font-mono",
                            yieldChange > 0 ? "text-green-500" : yieldChange < 0 ? "text-red-500" : "text-green-700"
                        )}>
                            {yieldChange > 0 ? (
                                <TrendingUp className="w-3 h-3" />
                            ) : yieldChange < 0 ? (
                                <TrendingDown className="w-3 h-3" />
                            ) : (
                                <Minus className="w-3 h-3" />
                            )}
                            <span>{Math.abs(yieldChangePercent).toFixed(2)}%</span>
                        </div>
                    )}
                </div>
                <div className="text-xs text-green-700 font-mono">
                    {strategy}
                </div>
            </div>

            <div className="mb-3 flex items-center gap-3">
                {/* ... existing header content ... */}
            </div>

            {/* @ts-expect-error Recharts type mismatch in newer versions */}
            <ResponsiveContainer width="100%" height="calc(100% - 80px)">
                <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                        <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                            <stop offset="50%" stopColor="#22c55e" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#14532d" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tick={{ fill: '#15803d', fontSize: 10 }}
                        tickLine={{ stroke: '#15803d' }}
                        axisLine={{ stroke: '#14532d' }}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tick={{ fill: '#15803d', fontSize: 10 }}
                        tickLine={{ stroke: '#15803d' }}
                        axisLine={{ stroke: '#14532d' }}
                        domain={['dataMin - 0.5', 'dataMax + 0.5']}
                        label={{ value: 'APY %', angle: -90, position: 'insideLeft', fill: '#15803d', fontSize: 10 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine
                        y={previousYield}
                        stroke="#15803d"
                        strokeDasharray="2 2"
                        strokeOpacity={0.5}
                    />
                    <Area
                        type="monotone"
                        dataKey="yield"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorYield)"
                        dot={{ fill: '#22c55e', r: 3 }}
                        activeDot={{ r: 5, fill: '#4ade80' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
