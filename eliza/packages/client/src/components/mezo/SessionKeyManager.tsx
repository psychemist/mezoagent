import * as React from 'react';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";

interface SessionKey {
    id: string;
    permissions: string[];
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
    expiry: string;
}

const MOCK_SESSION_KEY: SessionKey = {
    id: "0xSession...8f92",
    permissions: ["SWAP_TIGRIS", "DEPOSIT_UPSHIFT", "READ_BALANCE"],
    status: 'ACTIVE',
    expiry: "2025-12-26T12:00:00Z"
};

export function SessionKeyManager() {
    const [keyStatus, setKeyStatus] = useState<SessionKey['status']>(MOCK_SESSION_KEY.status);

    const handleRevoke = () => {
        setKeyStatus('REVOKED');
        // In real app, would call smart contract here
    };

    const handleRenew = () => {
        setKeyStatus('ACTIVE');
        // In real app, would generate new session key signature
    };

    return (
        <div className="bg-zinc-900 border border-green-900/40 rounded-md p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-500" />
                    <h3 className="text-sm font-mono font-bold text-green-500 tracking-wider">SESSION SECURITY</h3>
                </div>
                <Badge variant={keyStatus === 'ACTIVE' ? "default" : "destructive"}
                    className={keyStatus === 'ACTIVE' ? "bg-green-900 text-green-300 hover:bg-green-800" : ""}>
                    {keyStatus}
                </Badge>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-400 font-mono">
                    <span>Key ID:</span>
                    <span className="text-zinc-200">{MOCK_SESSION_KEY.id}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400 font-mono">
                    <span>Expiry:</span>
                    <span className="text-zinc-200">{new Date().toLocaleDateString()} + 24h</span>
                </div>
            </div>

            <div className="bg-black/50 p-2 rounded border border-green-900/20">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Permissions</p>
                <div className="flex flex-wrap gap-1">
                    {MOCK_SESSION_KEY.permissions.map(perm => (
                        <span key={perm} className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded border border-green-900/50">
                            {perm}
                        </span>
                    ))}
                </div>
            </div>

            <div className="pt-2">
                {keyStatus === 'ACTIVE' ? (
                    <Button
                        variant="destructive"
                        size="sm"
                        className="w-full h-7 text-xs bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40"
                        onClick={handleRevoke}
                    >
                        <ShieldAlert className="w-3 h-3 mr-2" />
                        REVOKE SESSION
                    </Button>
                ) : (
                    <Button
                        variant="default"
                        size="sm"
                        className="w-full h-7 text-xs bg-green-900/20 text-green-400 border border-green-900/50 hover:bg-green-900/40"
                        onClick={handleRenew}
                    >
                        <ShieldCheck className="w-3 h-3 mr-2" />
                        RENEW SESSION
                    </Button>
                )}
            </div>
        </div>
    );
}
