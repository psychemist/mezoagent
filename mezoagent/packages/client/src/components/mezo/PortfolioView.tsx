import * as React from 'react';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PortfolioAsset {
    id: string;
    symbol: string;
    name: string;
    amount: number;
    value: number;
    percentage: number;
    apy?: number;
    protocol: string;
    type: 'TOKEN' | 'VAULT' | 'LP';
    change24h?: number;
}

interface PortfolioViewProps {
    assets?: PortfolioAsset[];
    totalValue?: number;
    className?: string;
}

const MOCK_ASSETS: PortfolioAsset[] = [
    {
        id: '1',
        symbol: 'tBTC',
        name: 'Tether Bitcoin',
        amount: 5.432,
        value: 353080,
        percentage: 45.2,
        protocol: 'Wallet',
        type: 'TOKEN',
        change24h: 2.3
    },
    {
        id: '2',
        symbol: 'MUSD',
        name: 'Mezo USD',
        amount: 125000,
        value: 125000,
        percentage: 16.0,
        protocol: 'Wallet',
        type: 'TOKEN',
        change24h: 0.1
    },
    {
        id: '3',
        symbol: 'BTC',
        name: 'Bitcoin',
        amount: 2.0,
        value: 130000,
        percentage: 16.6,
        apy: 12.4,
        protocol: 'Upshift Vault',
        type: 'VAULT',
        change24h: 1.8
    },
    {
        id: '4',
        symbol: 'LP',
        name: 'tBTC/MUSD LP',
        amount: 150000,
        value: 150000,
        percentage: 19.2,
        apy: 8.5,
        protocol: 'Tigris DEX',
        type: 'LP',
        change24h: 0.5
    },
    {
        id: '5',
        symbol: 'MUSD',
        name: 'Mezo USD',
        amount: 18000,
        value: 18000,
        percentage: 2.3,
        apy: 6.2,
        protocol: 'Upshift Vault',
        type: 'VAULT',
        change24h: 0.2
    }
];

const COLORS = {
    tBTC: '#f7931a',
    MUSD: '#22c55e',
    BTC: '#f7931a',
    LP: '#8b5cf6',
    DEFAULT: '#6b7280'
};

export function PortfolioView({ 
    assets: externalAssets,
    totalValue: externalTotalValue,
    className 
}: PortfolioViewProps) {
    const [assets] = useState<PortfolioAsset[]>(externalAssets || MOCK_ASSETS);
    const [viewMode, setViewMode] = useState<'chart' | 'list'>('chart');
    const [groupBy, setGroupBy] = useState<'asset' | 'protocol' | 'type'>('asset');

    const totalValue = useMemo(() => {
        return externalTotalValue || assets.reduce((sum, asset) => sum + asset.value, 0);
    }, [externalTotalValue, assets]);

    const chartData = useMemo(() => {
        if (groupBy === 'protocol') {
            const grouped = assets.reduce((acc, asset) => {
                const key = asset.protocol;
                if (!acc[key]) {
                    acc[key] = { name: key, value: 0, color: COLORS.DEFAULT };
                }
                acc[key].value += asset.value;
                return acc;
            }, {} as Record<string, { name: string; value: number; color: string }>);
            return Object.values(grouped);
        } else if (groupBy === 'type') {
            const grouped = assets.reduce((acc, asset) => {
                const key = asset.type;
                if (!acc[key]) {
                    acc[key] = { name: key, value: 0, color: COLORS.DEFAULT };
                }
                acc[key].value += asset.value;
                return acc;
            }, {} as Record<string, { name: string; value: number; color: string }>);
            return Object.values(grouped);
        } else {
            return assets.map(asset => ({
                name: asset.symbol,
                value: asset.value,
                color: COLORS[asset.symbol as keyof typeof COLORS] || COLORS.DEFAULT
            }));
        }
    }, [assets, groupBy]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            const percentage = ((data.value / totalValue) * 100).toFixed(1);
            return (
                <div className="bg-black/95 border border-green-900/50 rounded-md p-3 shadow-xl font-mono text-xs">
                    <div className="text-green-400 mb-2">{data.name}</div>
                    <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                            <span className="text-green-700">Value:</span>
                            <span className="text-green-400 font-bold">${data.value.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-green-700">Allocation:</span>
                            <span className="text-green-400">{percentage}%</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    const getAssetColor = (symbol: string) => {
        return COLORS[symbol as keyof typeof COLORS] || COLORS.DEFAULT;
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Summary Card */}
            <Card className="bg-black/50 border-green-900/50">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-mono text-green-500">Portfolio Overview</CardTitle>
                            <CardDescription className="text-green-700">
                                Total portfolio value and allocation
                            </CardDescription>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-mono font-bold text-green-400">
                                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-green-700 mt-1">
                                {assets.length} assets
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant={viewMode === 'chart' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('chart')}
                        className="border-green-900/50 text-green-400 hover:bg-green-950/20"
                    >
                        Chart
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="border-green-900/50 text-green-400 hover:bg-green-950/20"
                    >
                        List
                    </Button>
                </div>
                {viewMode === 'chart' && (
                    <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                        <SelectTrigger className="w-40 bg-black/50 border-green-900/50 text-green-400">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-green-900/50">
                            <SelectItem value="asset">By Asset</SelectItem>
                            <SelectItem value="protocol">By Protocol</SelectItem>
                            <SelectItem value="type">By Type</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Chart View */}
            {viewMode === 'chart' && (
                <Card className="bg-black/50 border-green-900/50">
                    <CardContent className="p-6">
                        <ResponsiveContainer width="100%" height={400}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={120}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend 
                                    formatter={(value) => (
                                        <span className="text-green-400 font-mono text-xs">{value}</span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="space-y-2">
                    {assets
                        .sort((a, b) => b.value - a.value)
                        .map((asset) => (
                            <Card 
                                key={asset.id}
                                className="bg-black/50 border-green-900/50 hover:bg-zinc-900/70 transition-colors"
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            <div 
                                                className="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-white text-sm"
                                                style={{ backgroundColor: getAssetColor(asset.symbol) }}
                                            >
                                                {asset.symbol}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-sm font-mono font-semibold text-green-400">
                                                        {asset.name}
                                                    </h4>
                                                    <Badge 
                                                        variant="outline"
                                                        className="text-xs border-green-900/50 text-green-700"
                                                    >
                                                        {asset.protocol}
                                                    </Badge>
                                                    {asset.apy && (
                                                        <Badge 
                                                            variant="outline"
                                                            className="text-xs border-green-900/50 text-green-500"
                                                        >
                                                            {asset.apy.toFixed(1)}% APY
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-xs text-green-700 font-mono">
                                                    {asset.amount.toLocaleString(undefined, { 
                                                        minimumFractionDigits: asset.type === 'TOKEN' ? 2 : 0,
                                                        maximumFractionDigits: asset.type === 'TOKEN' ? 8 : 2
                                                    })} {asset.symbol}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right ml-4">
                                            <div className="text-lg font-mono font-bold text-green-400">
                                                ${asset.value.toLocaleString(undefined, { 
                                                    minimumFractionDigits: 2, 
                                                    maximumFractionDigits: 2 
                                                })}
                                            </div>
                                            <div className="flex items-center justify-end gap-1 text-xs text-green-700">
                                                <span>{asset.percentage.toFixed(1)}%</span>
                                                {asset.change24h !== undefined && (
                                                    <>
                                                        <span>•</span>
                                                        {asset.change24h >= 0 ? (
                                                            <TrendingUp className="w-3 h-3 text-green-500" />
                                                        ) : (
                                                            <TrendingDown className="w-3 h-3 text-red-500" />
                                                        )}
                                                        <span className={cn(
                                                            asset.change24h >= 0 ? "text-green-500" : "text-red-500"
                                                        )}>
                                                            {Math.abs(asset.change24h).toFixed(1)}%
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                </div>
            )}
        </div>
    );
}

