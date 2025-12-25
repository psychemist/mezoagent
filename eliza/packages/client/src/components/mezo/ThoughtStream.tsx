import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface LogEntry {
    id: string;
    timestamp: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error' | 'stealth';
}

const MOCK_LOGS: LogEntry[] = [
    { id: '1', timestamp: '14:02:01', message: 'Initializing Mezo Stealth Agent...', type: 'info' },
    { id: '2', timestamp: '14:02:05', message: 'Connected to Mezo RPC [Private Protocol]', type: 'success' },
    { id: '3', timestamp: '14:02:10', message: 'Scanning MUSD/tBTC Liquidity pools...', type: 'info' },
    { id: '4', timestamp: '14:02:12', message: 'Slippage > 0.5% on primary pool. Analyzing routes...', type: 'warning' },
    { id: '5', timestamp: '14:02:15', message: '[STEALTH] Routing trade via Enclave... 🛡️', type: 'stealth' }
];

export function ThoughtStream() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Simulate streaming logs
        let delay = 0;
        MOCK_LOGS.forEach((log) => {
            delay += 1500;
            setTimeout(() => {
                setLogs(prev => [...prev, log]);
            }, delay);
        });
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    return (
        <div className="flex flex-col h-full border rounded-md bg-black/90 font-mono text-sm shadow-xl border-green-900/50">
            <div className="p-3 border-b border-green-900/30 bg-green-950/10 flex justify-between items-center">
                <span className="text-green-500 font-bold">/// THOUGHT_STREAM_ACTVE</span>
                <span className="text-xs text-green-700 animate-pulse">● LIVE</span>
            </div>
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                    {logs.map((log) => (
                        <div key={log.id} className={cn("flex gap-3",
                            log.type === 'stealth' ? "text-purple-400" :
                                log.type === 'error' ? "text-red-500" :
                                    log.type === 'warning' ? "text-yellow-500" :
                                        log.type === 'success' ? "text-green-400" : "text-green-600/80"
                        )}>
                            <span className="opacity-50 text-xs text-green-800">[{log.timestamp}]</span>
                            <span>
                                {log.type === 'info' && '> '}
                                {log.message}
                            </span>
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>
            </ScrollArea>
        </div>
    );
}
