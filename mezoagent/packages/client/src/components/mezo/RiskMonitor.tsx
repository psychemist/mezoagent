import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RiskMetric {
    id: string;
    name: string;
    value: number;
    threshold: number;
    status: 'SAFE' | 'WARNING' | 'CRITICAL';
    trend: 'UP' | 'DOWN' | 'STABLE';
    description: string;
}

interface RiskMonitorProps {
    metrics?: RiskMetric[];
    autoRefresh?: boolean;
    refreshInterval?: number;
    className?: string;
}

const MOCK_METRICS: RiskMetric[] = [
    {
        id: 'musd-peg',
        name: 'MUSD Peg Stability',
        value: 0.999,
        threshold: 0.98,
        status: 'SAFE',
        trend: 'STABLE',
        description: 'MUSD maintains strong peg to USD'
    },
    {
        id: 'liquidity',
        name: 'Pool Liquidity',
        value: 85,
        threshold: 50,
        status: 'SAFE',
        trend: 'UP',
        description: 'Adequate liquidity in primary pools'
    },
    {
        id: 'slippage',
        name: 'Average Slippage',
        value: 0.3,
        threshold: 1.0,
        status: 'SAFE',
        trend: 'DOWN',
        description: 'Low slippage indicates healthy markets'
    },
    {
        id: 'tvl',
        name: 'Total Value Locked',
        value: 92,
        threshold: 70,
        status: 'SAFE',
        trend: 'UP',
        description: 'TVL remains above safe threshold'
    },
    {
        id: 'volatility',
        name: 'Market Volatility',
        value: 2.1,
        threshold: 5.0,
        status: 'SAFE',
        trend: 'STABLE',
        description: 'Volatility within acceptable range'
    }
];

export function RiskMonitor({
    metrics: externalMetrics,
    autoRefresh = true,
    refreshInterval = 5000,
    className
}: RiskMonitorProps) {
    const [metrics, setMetrics] = useState<RiskMetric[]>(externalMetrics || MOCK_METRICS);
    const [lastUpdate, setLastUpdate] = useState(new Date());

    // Sync with props
    useEffect(() => {
        if (externalMetrics) {
            setMetrics(externalMetrics);
        }
    }, [externalMetrics]);

    useEffect(() => {
        // Only run simulation if enabled AND no external metrics provided (or forced)
        if (!autoRefresh || externalMetrics) return;

        const interval = setInterval(() => {
            // Simulate metric updates
            setMetrics(prev => prev.map(metric => {
                const variance = (Math.random() - 0.5) * 0.02;
                let newValue = metric.value + variance;

                // Keep values within reasonable bounds
                if (metric.id === 'musd-peg') {
                    newValue = Math.max(0.95, Math.min(1.05, newValue));
                } else if (metric.id === 'slippage' || metric.id === 'volatility') {
                    newValue = Math.max(0, Math.min(10, newValue));
                } else {
                    newValue = Math.max(0, Math.min(100, newValue));
                }

                // Determine status
                let status: RiskMetric['status'] = 'SAFE';
                if (metric.id === 'musd-peg') {
                    status = newValue < metric.threshold ? 'CRITICAL' : newValue < 0.995 ? 'WARNING' : 'SAFE';
                } else {
                    const percentage = (newValue / metric.threshold) * 100;
                    status = percentage < 70 ? 'CRITICAL' : percentage < 85 ? 'WARNING' : 'SAFE';
                }

                // Determine trend
                const trend: RiskMetric['trend'] =
                    newValue > metric.value ? 'UP' :
                        newValue < metric.value ? 'DOWN' : 'STABLE';

                return {
                    ...metric,
                    value: newValue,
                    status,
                    trend
                };
            }));
            setLastUpdate(new Date());
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval]);

    const overallRisk = useMemo(() => {
        const criticalCount = metrics.filter(m => m.status === 'CRITICAL').length;
        const warningCount = metrics.filter(m => m.status === 'WARNING').length;

        if (criticalCount > 0) return 'CRITICAL';
        if (warningCount > 2) return 'HIGH';
        if (warningCount > 0) return 'MEDIUM';
        return 'LOW';
    }, [metrics]);

    const getStatusColor = (status: RiskMetric['status']) => {
        switch (status) {
            case 'CRITICAL':
                return 'text-red-500 border-red-900/50 bg-red-950/20';
            case 'WARNING':
                return 'text-yellow-500 border-yellow-900/50 bg-yellow-950/20';
            default:
                return 'text-green-500 border-green-900/50 bg-green-950/20';
        }
    };

    const getStatusIcon = (status: RiskMetric['status']) => {
        switch (status) {
            case 'CRITICAL':
                return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'WARNING':
                return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            default:
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        }
    };

    const getTrendIcon = (trend: RiskMetric['trend']) => {
        switch (trend) {
            case 'UP':
                return <TrendingUp className="w-3 h-3 text-green-500" />;
            case 'DOWN':
                return <TrendingDown className="w-3 h-3 text-red-500" />;
            default:
                return null;
        }
    };

    const formatValue = (metric: RiskMetric) => {
        if (metric.id === 'musd-peg') {
            return metric.value.toFixed(4);
        }
        if (metric.id === 'slippage' || metric.id === 'volatility') {
            return `${metric.value.toFixed(2)}%`;
        }
        return `${metric.value.toFixed(1)}%`;
    };

    const getProgressValue = (metric: RiskMetric) => {
        if (metric.id === 'musd-peg') {
            // For peg, we want to show how close to 1.0 it is
            return Math.abs(1.0 - metric.value) * 1000; // Scale for visibility
        }
        // For others, show percentage of threshold
        return (metric.value / metric.threshold) * 100;
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Overall Risk Indicator */}
            <Card className={cn(
                "bg-black/50 border-2",
                overallRisk === 'CRITICAL' ? "border-red-900/50" :
                    overallRisk === 'HIGH' ? "border-orange-900/50" :
                        overallRisk === 'MEDIUM' ? "border-yellow-900/50" :
                            "border-green-900/50"
            )}>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-mono text-green-500">Overall Risk Assessment</CardTitle>
                        <Badge
                            variant="outline"
                            className={cn(
                                "font-mono text-xs",
                                overallRisk === 'CRITICAL' ? "text-red-400 border-red-900/50" :
                                    overallRisk === 'HIGH' ? "text-orange-400 border-orange-900/50" :
                                        overallRisk === 'MEDIUM' ? "text-yellow-400 border-yellow-900/50" :
                                            "text-green-400 border-green-900/50"
                            )}
                        >
                            {overallRisk}
                        </Badge>
                    </div>
                    <CardDescription className="text-green-700 text-xs">
                        Last updated: {lastUpdate.toLocaleTimeString()}
                    </CardDescription>
                </CardHeader>
            </Card>

            {/* Individual Metrics */}
            <div className="space-y-3">
                {metrics.map((metric) => (
                    <Card
                        key={metric.id}
                        className={cn("bg-black/50 border", getStatusColor(metric.status))}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-start gap-2 flex-1">
                                    {getStatusIcon(metric.status)}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-sm font-mono text-green-400 font-semibold">
                                                {metric.name}
                                            </h4>
                                            {getTrendIcon(metric.trend)}
                                        </div>
                                        <p className="text-xs text-green-700">{metric.description}</p>
                                    </div>
                                </div>
                                <div className="text-right ml-4">
                                    <div className="text-lg font-mono font-bold text-green-400">
                                        {formatValue(metric)}
                                    </div>
                                    <div className="text-xs text-green-700">
                                        Threshold: {metric.threshold}
                                        {metric.id !== 'musd-peg' && '%'}
                                    </div>
                                </div>
                            </div>
                            <Progress
                                value={getProgressValue(metric)}
                                className={cn(
                                    "h-2",
                                    metric.status === 'CRITICAL' ? "bg-red-950/50" :
                                        metric.status === 'WARNING' ? "bg-yellow-950/50" :
                                            "bg-green-950/50"
                                )}
                            />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

