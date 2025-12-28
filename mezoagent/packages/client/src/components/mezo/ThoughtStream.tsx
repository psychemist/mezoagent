import * as React from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { X, Search, Filter, Trash2, Download } from "lucide-react";

export interface LogEntry {
    id: string;
    timestamp: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error' | 'stealth';
    metadata?: Record<string, unknown>;
}

interface ThoughtStreamProps {
    logs?: LogEntry[];
    onClear?: () => void;
    onExport?: (logs: LogEntry[]) => void;
    autoScroll?: boolean;
    maxLogs?: number;
    className?: string;
}

const MOCK_LOGS: LogEntry[] = [
    { id: '1', timestamp: '14:02:01', message: 'Initializing Mezo Stealth Agent...', type: 'info' },
    { id: '2', timestamp: '14:02:05', message: 'Connected to Mezo RPC [Private Protocol]', type: 'success' },
    { id: '3', timestamp: '14:02:10', message: 'Scanning MUSD/tBTC Liquidity pools...', type: 'info' },
    { id: '4', timestamp: '14:02:12', message: 'Slippage > 0.5% on primary pool. Analyzing routes...', type: 'warning' },
    { id: '5', timestamp: '14:02:15', message: '[STEALTH] Routing trade via Enclave... 🛡️', type: 'stealth' }
];

export function ThoughtStream({ 
    logs: externalLogs, 
    onClear, 
    onExport,
    autoScroll = true,
    maxLogs = 1000,
    className 
}: ThoughtStreamProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
    const [filterType, setFilterType] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Use external logs if provided, otherwise use mock data
    useEffect(() => {
        if (externalLogs) {
            setLogs(externalLogs.slice(-maxLogs));
        } else {
            // Simulate streaming logs
            let delay = 0;
            const timeouts: NodeJS.Timeout[] = [];
            MOCK_LOGS.forEach((log) => {
                delay += 1500;
                const timeout = setTimeout(() => {
                    if (!isPaused) {
                        setLogs(prev => {
                            const newLogs = [...prev, log];
                            return newLogs.slice(-maxLogs);
                        });
                    }
                }, delay);
                timeouts.push(timeout);
            });
            return () => timeouts.forEach(clearTimeout);
        }
    }, [externalLogs, maxLogs, isPaused]);

    // Filter and search logs
    useEffect(() => {
        let filtered = logs;
        
        if (filterType !== 'all') {
            filtered = filtered.filter(log => log.type === filterType);
        }
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(log => 
                log.message.toLowerCase().includes(query) ||
                log.timestamp.includes(query)
            );
        }
        
        setFilteredLogs(filtered);
    }, [logs, filterType, searchQuery]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (autoScroll && !isPaused && endRef.current) {
            endRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [filteredLogs, autoScroll, isPaused]);

    const handleClear = useCallback(() => {
        setLogs([]);
        setFilteredLogs([]);
        onClear?.();
    }, [onClear]);

    const handleExport = useCallback(() => {
        if (onExport) {
            onExport(filteredLogs);
        } else {
            const dataStr = JSON.stringify(filteredLogs, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `mezo-logs-${new Date().toISOString()}.json`;
            link.click();
            URL.revokeObjectURL(url);
        }
    }, [filteredLogs, onExport]);

    const getLogIcon = (type: LogEntry['type']) => {
        switch (type) {
            case 'success': return '✓';
            case 'error': return '✗';
            case 'warning': return '⚠';
            case 'stealth': return '🛡️';
            default: return '>';
        }
    };

    const getLogColor = (type: LogEntry['type']) => {
        switch (type) {
            case 'stealth': return "text-purple-400";
            case 'error': return "text-red-500";
            case 'warning': return "text-yellow-500";
            case 'success': return "text-green-400";
            default: return "text-green-600/80";
        }
    };

    return (
        <div className={cn("flex flex-col h-full border rounded-md bg-black/90 font-mono text-sm shadow-xl border-green-900/50", className)}>
            <div className="p-3 border-b border-green-900/30 bg-green-950/10">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-green-500 font-bold">/// THOUGHT_STREAM</span>
                        <span className={cn("text-xs animate-pulse", isPaused ? "text-yellow-600" : "text-green-700")}>
                            {isPaused ? "● PAUSED" : "● LIVE"}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-green-600 hover:text-green-400 hover:bg-green-950/20"
                            onClick={() => setIsPaused(!isPaused)}
                        >
                            {isPaused ? "▶" : "⏸"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-green-600 hover:text-green-400 hover:bg-green-950/20"
                            onClick={handleExport}
                            title="Export logs"
                        >
                            <Download className="w-3 h-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-red-600 hover:text-red-400 hover:bg-red-950/20"
                            onClick={handleClear}
                            title="Clear logs"
                        >
                            <Trash2 className="w-3 h-3" />
                        </Button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-green-700" />
                        <Input
                            placeholder="Search logs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-7 pl-7 pr-7 text-xs bg-black/50 border-green-900/50 text-green-400 placeholder:text-green-800 focus-visible:ring-green-900"
                        />
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-7 w-7 p-0 text-green-700 hover:text-green-400"
                                onClick={() => setSearchQuery('')}
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        )}
                    </div>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="h-7 w-24 text-xs bg-black/50 border-green-900/50 text-green-400">
                            <Filter className="w-3 h-3 mr-1" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-green-900/50">
                            <SelectItem value="all" className="text-green-400 focus:text-green-300">All</SelectItem>
                            <SelectItem value="info" className="text-green-400 focus:text-green-300">Info</SelectItem>
                            <SelectItem value="success" className="text-green-400 focus:text-green-300">Success</SelectItem>
                            <SelectItem value="warning" className="text-yellow-400 focus:text-yellow-300">Warning</SelectItem>
                            <SelectItem value="error" className="text-red-400 focus:text-red-300">Error</SelectItem>
                            <SelectItem value="stealth" className="text-purple-400 focus:text-purple-300">Stealth</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-2">
                    {filteredLogs.length === 0 ? (
                        <div className="text-center text-green-800/50 py-8 text-xs">
                            {searchQuery || filterType !== 'all' ? 'No logs match your filters' : 'No logs yet...'}
                        </div>
                    ) : (
                        filteredLogs.map((log) => (
                            <div 
                                key={log.id} 
                                className={cn("flex gap-3 items-start group hover:bg-green-950/10 rounded px-2 py-1 transition-colors", getLogColor(log.type))}
                                role="log"
                                aria-label={`${log.type} log at ${log.timestamp}`}
                            >
                                <span className="opacity-50 text-xs text-green-800 flex-shrink-0">[{log.timestamp}]</span>
                                <span className="flex-shrink-0">{getLogIcon(log.type)}</span>
                                <span className="flex-1 break-words">{log.message}</span>
                            </div>
                        ))
                    )}
                    <div ref={endRef} />
                </div>
            </ScrollArea>
            <div className="p-2 border-t border-green-900/30 bg-green-950/10 text-xs text-green-700 flex justify-between">
                <span>{filteredLogs.length} / {logs.length} logs</span>
                <span>{new Date().toLocaleTimeString()}</span>
            </div>
        </div>
    );
}
