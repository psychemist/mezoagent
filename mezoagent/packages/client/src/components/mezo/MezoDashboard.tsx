import * as React from 'react';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { YieldChart } from "./YieldChart";
import { ThoughtStream, type LogEntry } from "./ThoughtStream";
import { SessionKeyManager, type SessionKey } from "./SessionKeyManager";
import { TransactionHistory } from "./TransactionHistory";
import { RiskMonitor } from "./RiskMonitor";
import { PortfolioView } from "./PortfolioView";
import { useMezoRealData } from "../../hooks/useMezoRealData";
import {
    Wallet,
    TrendingUp,
    Shield,
    Activity,
    AlertTriangle,
    RefreshCw,
    Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardMetrics {
    totalValue: number;
    totalYield: number;
    activePositions: number;
    sessionKeys: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    lastUpdate: Date;
}

interface MezoDashboardProps {
    metrics?: DashboardMetrics;
    logs?: LogEntry[];
    sessionKeys?: SessionKey[];
    onRefresh?: () => void;
    className?: string;
}

const MOCK_METRICS: DashboardMetrics = {
    totalValue: 125432.50,
    totalYield: 6.2,
    activePositions: 3,
    sessionKeys: 2,
    riskLevel: 'LOW',
    lastUpdate: new Date()
};

export function MezoDashboard({
    metrics = MOCK_METRICS,
    logs,
    sessionKeys,
    onRefresh,
    className
}: MezoDashboardProps) {
    const [activeTab, setActiveTab] = useState('overview');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Integration of Real Data Hook
    const {
        metrics: realMetrics,
        assets: realAssets,
        yieldData: realYieldData,
        isLive,
        refresh
    } = useMezoRealData();

    // Use absolute real data if live, otherwise fallback to props or mocks
    const displayMetrics = isLive && realMetrics ? realMetrics : (metrics || MOCK_METRICS);
    const displayAssets = isLive && realAssets ? realAssets : undefined; // PortfolioView handles undefined by using specific logic or prop

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            if (isLive) {
                await refresh();
            } else {
                await onRefresh?.();
            }
        } finally {
            setTimeout(() => setIsRefreshing(false), 1000);
        }
    };

    const riskColor = useMemo(() => {
        switch (displayMetrics.riskLevel) {
            case 'CRITICAL': return 'text-red-500';
            case 'HIGH': return 'text-orange-500';
            case 'MEDIUM': return 'text-yellow-500';
            default: return 'text-green-500';
        }
    }, [displayMetrics.riskLevel]);

    return (
        <div className={cn("flex flex-col h-full bg-background", className)}>
            {/* Header */}
            <div className="border-b border-border p-4 bg-card">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold font-mono text-green-500">MEZO DASHBOARD</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Autonomous Finance Agent Control Center
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="border-green-900/50 text-green-400 hover:bg-green-950/20"
                        >
                            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-green-900/50 text-green-400 hover:bg-green-950/20"
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
                        </Button>
                    </div>
                </div>

                {/* Simulation Mode Banner */}
                {!isLive && (
                    <div className="bg-yellow-900/20 border-b border-yellow-900/50 p-2 text-center text-xs text-yellow-500 font-mono">
                        ⚠ SIMULATION MODE: Configure VITE_MEZO_RPC_URL & SMART_ACCOUNT to enable real-time data.
                    </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-black/50 border-green-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-mono text-green-700">Total Value</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-green-500" />
                                <span className="text-lg font-bold text-green-400 font-mono">
                                    ${displayMetrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/50 border-green-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-mono text-green-700">Total Yield</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-green-500" />
                                <span className="text-lg font-bold text-green-400 font-mono">
                                    {displayMetrics.totalYield.toFixed(2)}%
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/50 border-green-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-mono text-green-700">Active Positions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-green-500" />
                                <span className="text-lg font-bold text-green-400 font-mono">
                                    {displayMetrics.activePositions}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/50 border-green-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-mono text-green-700">Risk Level</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className={cn("w-4 h-4", riskColor)} />
                                <Badge
                                    variant="outline"
                                    className={cn("font-mono", riskColor, "border-current")}
                                >
                                    {displayMetrics.riskLevel}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <TabsList className="mx-4 mt-4 bg-black/50 border-green-900/50">
                        <TabsTrigger value="overview" className="data-[state=active]:bg-green-900/20 data-[state=active]:text-green-400">
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="portfolio" className="data-[state=active]:bg-green-900/20 data-[state=active]:text-green-400">
                            Portfolio
                        </TabsTrigger>
                        <TabsTrigger value="transactions" className="data-[state=active]:bg-green-900/20 data-[state=active]:text-green-400">
                            Transactions
                        </TabsTrigger>
                        <TabsTrigger value="security" className="data-[state=active]:bg-green-900/20 data-[state=active]:text-green-400">
                            <Shield className="w-4 h-4 mr-2" />
                            Security
                        </TabsTrigger>
                        <TabsTrigger value="monitoring" className="data-[state=active]:bg-green-900/20 data-[state=active]:text-green-400">
                            Monitoring
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="flex-1 overflow-auto p-4 space-y-4 mt-0">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card className="bg-black/50 border-green-900/50">
                                <CardHeader>
                                    <CardTitle className="text-sm font-mono text-green-500">Yield Performance</CardTitle>
                                    <CardDescription className="text-green-700">7-day APY trend</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <YieldChart data={realYieldData} />
                                </CardContent>
                            </Card>

                            <Card className="bg-black/50 border-green-900/50">
                                <CardHeader>
                                    <CardTitle className="text-sm font-mono text-green-500">Risk Monitor</CardTitle>
                                    <CardDescription className="text-green-700">Real-time risk assessment</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <RiskMonitor />
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="bg-black/50 border-green-900/50">
                            <CardHeader>
                                <CardTitle className="text-sm font-mono text-green-500">Agent Thought Stream</CardTitle>
                                <CardDescription className="text-green-700">Live agent decision-making process</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ThoughtStream logs={logs} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="portfolio" className="flex-1 overflow-auto p-4 mt-0">
                        <PortfolioView assets={displayAssets} totalValue={displayMetrics.totalValue} />
                    </TabsContent>

                    <TabsContent value="transactions" className="flex-1 overflow-auto p-4 mt-0">
                        <TransactionHistory />
                    </TabsContent>

                    <TabsContent value="security" className="flex-1 overflow-auto p-4 mt-0">
                        <SessionKeyManager keys={sessionKeys} />
                    </TabsContent>

                    <TabsContent value="monitoring" className="flex-1 overflow-auto p-4 mt-0">
                        <div className="space-y-4">
                            <Card className="bg-black/50 border-green-900/50">
                                <CardHeader>
                                    <CardTitle className="text-sm font-mono text-green-500">Risk Monitor</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <RiskMonitor />
                                </CardContent>
                            </Card>
                            <Card className="bg-black/50 border-green-900/50">
                                <CardHeader>
                                    <CardTitle className="text-sm font-mono text-green-500">Thought Stream</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[400px]">
                                    <ThoughtStream logs={logs} />
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Footer */}
            <div className="border-t border-border p-2 bg-card">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Last updated: {displayMetrics.lastUpdate.toLocaleTimeString()}</span>
                    <span className="font-mono text-green-700">MEZO v1.0.0</span>
                </div>
            </div>
        </div >
    );
}

