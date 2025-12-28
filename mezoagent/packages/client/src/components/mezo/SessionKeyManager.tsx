import * as React from 'react';
import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, ShieldAlert, ShieldCheck, Plus, Copy, ExternalLink, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export interface SessionKey {
    id: string;
    address: string;
    permissions: string[];
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING';
    expiry: string;
    createdAt: string;
    lastUsed?: string;
    maxSpend?: string;
    rateLimit?: number;
}

interface SessionKeyManagerProps {
    keys?: SessionKey[];
    onCreate?: (key: Omit<SessionKey, 'id' | 'createdAt'>) => Promise<void>;
    onRevoke?: (keyId: string) => Promise<void>;
    onRenew?: (keyId: string) => Promise<void>;
    onUpdate?: (keyId: string, updates: Partial<SessionKey>) => Promise<void>;
    className?: string;
}

const MOCK_SESSION_KEY: SessionKey = {
    id: "0xSession...8f92",
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    permissions: ["SWAP_TIGRIS", "DEPOSIT_UPSHIFT", "READ_BALANCE"],
    status: 'ACTIVE',
    expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    maxSpend: "1000000",
    rateLimit: 100
};

const AVAILABLE_PERMISSIONS = [
    { id: "SWAP_TIGRIS", label: "Swap on Tigris DEX", description: "Execute token swaps" },
    { id: "DEPOSIT_UPSHIFT", label: "Deposit to Upshift", description: "Deposit assets to yield vaults" },
    { id: "READ_BALANCE", label: "Read Balance", description: "View account balances" },
    { id: "WITHDRAW_UPSHIFT", label: "Withdraw from Upshift", description: "Withdraw from yield vaults" },
    { id: "MANAGE_POSITIONS", label: "Manage Positions", description: "Open and close positions" },
    { id: "EXECUTE_INTENT", label: "Execute Intent", description: "Execute intent-based transactions" }
];

export function SessionKeyManager({ 
    keys: externalKeys,
    onCreate,
    onRevoke,
    onRenew,
    onUpdate,
    className 
}: SessionKeyManagerProps) {
    const { toast } = useToast();
    const [keys, setKeys] = useState<SessionKey[]>(externalKeys || [MOCK_SESSION_KEY]);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [expiryDays, setExpiryDays] = useState(1);
    const [maxSpend, setMaxSpend] = useState("");
    const [rateLimit, setRateLimit] = useState(100);

    const activeKeys = useMemo(() => keys.filter(k => k.status === 'ACTIVE'), [keys]);
    const expiredKeys = useMemo(() => keys.filter(k => k.status === 'EXPIRED'), [keys]);
    const revokedKeys = useMemo(() => keys.filter(k => k.status === 'REVOKED'), [keys]);

    const handleCreate = async () => {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiryDays);
        
        const newKey: Omit<SessionKey, 'id' | 'createdAt'> = {
            address: `0x${Math.random().toString(16).substr(2, 40)}`,
            permissions: selectedPermissions,
            status: 'PENDING',
            expiry: expiryDate.toISOString(),
            maxSpend: maxSpend || undefined,
            rateLimit: rateLimit || undefined
        };

        if (onCreate) {
            await onCreate(newKey);
        } else {
            // Mock creation
            const createdKey: SessionKey = {
                ...newKey,
                id: `key_${Date.now()}`,
                createdAt: new Date().toISOString(),
                status: 'ACTIVE'
            };
            setKeys(prev => [...prev, createdKey]);
        }
        
        setIsCreateDialogOpen(false);
        setSelectedPermissions([]);
        setExpiryDays(1);
        setMaxSpend("");
        setRateLimit(100);
        toast({
            title: "Session Key Created",
            description: "New session key has been generated successfully.",
        });
    };

    const handleRevoke = async (keyId: string) => {
        if (onRevoke) {
            await onRevoke(keyId);
        } else {
            setKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'REVOKED' as const } : k));
        }
        toast({
            title: "Session Key Revoked",
            description: "The session key has been revoked and can no longer be used.",
            variant: "destructive"
        });
    };

    const handleRenew = async (keyId: string) => {
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + expiryDays);
        
        if (onRenew) {
            await onRenew(keyId);
        } else {
            setKeys(prev => prev.map(k => 
                k.id === keyId 
                    ? { ...k, status: 'ACTIVE' as const, expiry: newExpiry.toISOString() } 
                    : k
            ));
        }
        toast({
            title: "Session Key Renewed",
            description: "The session key has been renewed successfully.",
        });
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: "Copied",
            description: "Address copied to clipboard",
        });
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const getTimeUntilExpiry = (expiry: string) => {
        const now = new Date();
        const expiryDate = new Date(expiry);
        const diff = expiryDate.getTime() - now.getTime();
        
        if (diff < 0) return "Expired";
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h`;
        return `${Math.floor(diff / (1000 * 60))}m`;
    };

    const KeyCard = ({ key: sessionKey }: { key: SessionKey }) => {
        const isExpiringSoon = new Date(sessionKey.expiry).getTime() - Date.now() < 24 * 60 * 60 * 1000;
        
        return (
            <div className="bg-zinc-900/50 border border-green-900/40 rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className={cn(
                            "w-4 h-4",
                            sessionKey.status === 'ACTIVE' ? "text-green-500" :
                            sessionKey.status === 'EXPIRED' ? "text-yellow-500" :
                            "text-red-500"
                        )} />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-zinc-200">
                                    {formatAddress(sessionKey.address)}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-zinc-500 hover:text-zinc-300"
                                    onClick={() => handleCopy(sessionKey.address)}
                                >
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    <Badge 
                        variant={sessionKey.status === 'ACTIVE' ? "default" : "destructive"}
                        className={cn(
                            sessionKey.status === 'ACTIVE' ? "bg-green-900 text-green-300 hover:bg-green-800" :
                            sessionKey.status === 'EXPIRED' ? "bg-yellow-900 text-yellow-300" :
                            "bg-red-900 text-red-300"
                        )}
                    >
                        {sessionKey.status}
                    </Badge>
                </div>

                <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-zinc-400">
                        <span>Expires:</span>
                        <span className={cn(
                            "text-zinc-200",
                            isExpiringSoon && sessionKey.status === 'ACTIVE' && "text-yellow-400"
                        )}>
                            {getTimeUntilExpiry(sessionKey.expiry)}
                            {isExpiringSoon && sessionKey.status === 'ACTIVE' && (
                                <AlertCircle className="w-3 h-3 inline ml-1" />
                            )}
                        </span>
                    </div>
                    {sessionKey.lastUsed && (
                        <div className="flex justify-between text-zinc-400">
                            <span>Last Used:</span>
                            <span className="text-zinc-200">
                                {new Date(sessionKey.lastUsed).toLocaleString()}
                            </span>
                        </div>
                    )}
                    {sessionKey.maxSpend && (
                        <div className="flex justify-between text-zinc-400">
                            <span>Max Spend:</span>
                            <span className="text-zinc-200">
                                ${parseInt(sessionKey.maxSpend).toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>

                <div className="bg-black/50 p-2 rounded border border-green-900/20">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Permissions</p>
                    <div className="flex flex-wrap gap-1">
                        {sessionKey.permissions.map(perm => (
                            <span 
                                key={perm} 
                                className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded border border-green-900/50"
                            >
                                {perm}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    {sessionKey.status === 'ACTIVE' ? (
                        <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1 h-7 text-xs bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40"
                            onClick={() => handleRevoke(sessionKey.id)}
                        >
                            <ShieldAlert className="w-3 h-3 mr-2" />
                            REVOKE
                        </Button>
                    ) : sessionKey.status === 'EXPIRED' ? (
                        <Button
                            variant="default"
                            size="sm"
                            className="flex-1 h-7 text-xs bg-green-900/20 text-green-400 border border-green-900/50 hover:bg-green-900/40"
                            onClick={() => handleRenew(sessionKey.id)}
                        >
                            <ShieldCheck className="w-3 h-3 mr-2" />
                            RENEW
                        </Button>
                    ) : null}
                </div>
            </div>
        );
    };

    return (
        <div className={cn("bg-zinc-900 border border-green-900/40 rounded-md p-4 space-y-4", className)}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-500" />
                    <h3 className="text-sm font-mono font-bold text-green-500 tracking-wider">SESSION SECURITY</h3>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            size="sm"
                            className="h-7 text-xs bg-green-900/20 text-green-400 border border-green-900/50 hover:bg-green-900/40"
                        >
                            <Plus className="w-3 h-3 mr-2" />
                            CREATE KEY
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-black border-green-900/50 text-green-400 max-w-md">
                        <DialogHeader>
                            <DialogTitle className="font-mono">Create Session Key</DialogTitle>
                            <DialogDescription className="text-green-700">
                                Generate a new session key with specific permissions
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="expiry" className="text-green-400">Expiry (days)</Label>
                                <Input
                                    id="expiry"
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={expiryDays}
                                    onChange={(e) => setExpiryDays(parseInt(e.target.value) || 1)}
                                    className="bg-black/50 border-green-900/50 text-green-400"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxSpend" className="text-green-400">Max Spend (USD, optional)</Label>
                                <Input
                                    id="maxSpend"
                                    type="number"
                                    value={maxSpend}
                                    onChange={(e) => setMaxSpend(e.target.value)}
                                    placeholder="No limit"
                                    className="bg-black/50 border-green-900/50 text-green-400"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="rateLimit" className="text-green-400">Rate Limit (tx/hour, optional)</Label>
                                <Input
                                    id="rateLimit"
                                    type="number"
                                    value={rateLimit}
                                    onChange={(e) => setRateLimit(parseInt(e.target.value) || 0)}
                                    className="bg-black/50 border-green-900/50 text-green-400"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-green-400">Permissions</Label>
                                <ScrollArea className="h-32 border border-green-900/50 rounded p-2">
                                    <div className="space-y-2">
                                        {AVAILABLE_PERMISSIONS.map(perm => (
                                            <div key={perm.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={perm.id}
                                                    checked={selectedPermissions.includes(perm.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedPermissions(prev => [...prev, perm.id]);
                                                        } else {
                                                            setSelectedPermissions(prev => prev.filter(p => p !== perm.id));
                                                        }
                                                    }}
                                                    className="border-green-900/50"
                                                />
                                                <Label 
                                                    htmlFor={perm.id} 
                                                    className="text-xs text-green-400 cursor-pointer flex-1"
                                                >
                                                    <div className="font-semibold">{perm.label}</div>
                                                    <div className="text-green-700 text-[10px]">{perm.description}</div>
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setIsCreateDialogOpen(false)}
                                className="border-green-900/50 text-green-400 hover:bg-green-950/20"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreate}
                                disabled={selectedPermissions.length === 0}
                                className="bg-green-900/20 text-green-400 border border-green-900/50 hover:bg-green-900/40"
                            >
                                Create Key
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                    {activeKeys.length > 0 && (
                        <div>
                            <h4 className="text-xs font-mono text-green-600 mb-2">ACTIVE ({activeKeys.length})</h4>
                            <div className="space-y-2">
                                {activeKeys.map(key => (
                                    <KeyCard key={key.id} key={key} />
                                ))}
                            </div>
                        </div>
                    )}
                    {expiredKeys.length > 0 && (
                        <div>
                            <h4 className="text-xs font-mono text-yellow-600 mb-2">EXPIRED ({expiredKeys.length})</h4>
                            <div className="space-y-2">
                                {expiredKeys.map(key => (
                                    <KeyCard key={key.id} key={key} />
                                ))}
                            </div>
                        </div>
                    )}
                    {revokedKeys.length > 0 && (
                        <div>
                            <h4 className="text-xs font-mono text-red-600 mb-2">REVOKED ({revokedKeys.length})</h4>
                            <div className="space-y-2">
                                {revokedKeys.map(key => (
                                    <KeyCard key={key.id} key={key} />
                                ))}
                            </div>
                        </div>
                    )}
                    {keys.length === 0 && (
                        <div className="text-center text-green-800/50 py-8 text-xs">
                            No session keys. Create one to get started.
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
