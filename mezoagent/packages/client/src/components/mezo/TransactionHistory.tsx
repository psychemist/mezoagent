import * as React from 'react';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Search,
    Filter,
    ExternalLink,
    CheckCircle2,
    XCircle,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    Copy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export interface Transaction {
    id: string;
    hash: string;
    type: 'SWAP' | 'DEPOSIT' | 'WITHDRAW' | 'INTENT' | 'OTHER';
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    fromToken?: string;
    toToken?: string;
    amount: string;
    value: number;
    timestamp: Date;
    protocol: string;
    gasUsed?: string;
    gasPrice?: string;
    metadata?: Record<string, unknown>;
}

interface TransactionHistoryProps {
    transactions?: Transaction[];
    onTransactionClick?: (tx: Transaction) => void;
    className?: string;
}

const MOCK_TRANSACTIONS: Transaction[] = [
    {
        id: '1',
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        type: 'SWAP',
        status: 'SUCCESS',
        fromToken: 'tBTC',
        toToken: 'MUSD',
        amount: '1.5',
        value: 97500,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        protocol: 'Tigris DEX',
        gasUsed: '125000',
        gasPrice: '20'
    },
    {
        id: '2',
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        type: 'DEPOSIT',
        status: 'SUCCESS',
        toToken: 'BTC',
        amount: '2.0',
        value: 130000,
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
        protocol: 'Upshift',
        gasUsed: '98000',
        gasPrice: '20'
    },
    {
        id: '3',
        hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        type: 'INTENT',
        status: 'PENDING',
        fromToken: 'MUSD',
        toToken: 'tBTC',
        amount: '50000',
        value: 50000,
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        protocol: 'Solver Network',
    },
    {
        id: '4',
        hash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        type: 'SWAP',
        status: 'FAILED',
        fromToken: 'tBTC',
        toToken: 'MUSD',
        amount: '0.5',
        value: 32500,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        protocol: 'Tigris DEX',
        gasUsed: '21000',
        gasPrice: '20'
    }
];

export function TransactionHistory({
    transactions: externalTransactions,
    onTransactionClick,
    className
}: TransactionHistoryProps) {
    const { toast } = useToast();
    const transactions = useMemo(() => externalTransactions || MOCK_TRANSACTIONS, [externalTransactions]);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const matchesSearch = !searchQuery ||
                tx.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tx.protocol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (tx.fromToken && tx.fromToken.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (tx.toToken && tx.toToken.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesType = typeFilter === 'all' || tx.type === typeFilter;
            const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;

            return matchesSearch && matchesType && matchesStatus;
        });
    }, [transactions, searchQuery, typeFilter, statusFilter]);

    const handleCopyHash = (hash: string) => {
        navigator.clipboard.writeText(hash);
        toast({
            title: "Copied",
            description: "Transaction hash copied to clipboard",
        });
    };

    const handleViewOnExplorer = (hash: string) => {
        // In real implementation, open blockchain explorer
        window.open(`https://explorer.mezo.network/tx/${hash}`, '_blank');
    };

    const getStatusIcon = (status: Transaction['status']) => {
        switch (status) {
            case 'SUCCESS':
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'FAILED':
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Clock className="w-4 h-4 text-yellow-500" />;
        }
    };

    const getTypeIcon = (type: Transaction['type']) => {
        switch (type) {
            case 'SWAP':
            case 'DEPOSIT':
                return <ArrowDownRight className="w-4 h-4 text-blue-400" />;
            case 'WITHDRAW':
                return <ArrowUpRight className="w-4 h-4 text-purple-400" />;
            default:
                return <ExternalLink className="w-4 h-4 text-green-400" />;
        }
    };

    const formatHash = (hash: string) => {
        return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
    };

    return (
        <Card className={cn("bg-black/50 border-green-900/50", className)}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-mono text-green-500">Transaction History</CardTitle>
                        <CardDescription className="text-green-700">
                            View and filter all agent transactions
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-green-400 border-green-900/50">
                        {filteredTransactions.length} transactions
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-700" />
                        <Input
                            placeholder="Search by hash, protocol, or token..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 bg-black/50 border-green-900/50 text-green-400 placeholder:text-green-800"
                        />
                    </div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-32 bg-black/50 border-green-900/50 text-green-400">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-green-900/50">
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="SWAP">Swap</SelectItem>
                            <SelectItem value="DEPOSIT">Deposit</SelectItem>
                            <SelectItem value="WITHDRAW">Withdraw</SelectItem>
                            <SelectItem value="INTENT">Intent</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-32 bg-black/50 border-green-900/50 text-green-400">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-green-900/50">
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="SUCCESS">Success</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="FAILED">Failed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Transaction List */}
                <ScrollArea className="h-[600px]">
                    <div className="space-y-2">
                        {filteredTransactions.length === 0 ? (
                            <div className="text-center py-12 text-green-800/50 text-sm">
                                No transactions found matching your filters
                            </div>
                        ) : (
                            filteredTransactions.map((tx) => (
                                <Card
                                    key={tx.id}
                                    className="bg-zinc-900/50 border-green-900/40 hover:bg-zinc-900/70 transition-colors cursor-pointer"
                                    onClick={() => onTransactionClick?.(tx)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3 flex-1">
                                                <div className="mt-1">
                                                    {getTypeIcon(tx.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge
                                                            variant="outline"
                                                            className="font-mono text-xs border-green-900/50 text-green-400"
                                                        >
                                                            {tx.type}
                                                        </Badge>
                                                        <span className="text-xs font-mono text-green-700">
                                                            {tx.protocol}
                                                        </span>
                                                        {getStatusIcon(tx.status)}
                                                    </div>
                                                    <div className="text-sm font-mono text-green-400 mb-1">
                                                        {tx.fromToken && (
                                                            <span>{tx.amount} {tx.fromToken}</span>
                                                        )}
                                                        {tx.fromToken && tx.toToken && (
                                                            <span className="mx-2">→</span>
                                                        )}
                                                        {tx.toToken && (
                                                            <span>{tx.toToken}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-green-700 font-mono">
                                                        <span>${tx.value.toLocaleString()}</span>
                                                        {tx.gasUsed && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Gas: {parseInt(tx.gasUsed).toLocaleString()}</span>
                                                            </>
                                                        )}
                                                        <span>•</span>
                                                        <span>{format(tx.timestamp, 'MMM d, HH:mm')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 ml-4">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 text-green-700 hover:text-green-400"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopyHash(tx.hash);
                                                    }}
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 text-green-700 hover:text-green-400"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleViewOnExplorer(tx.hash);
                                                    }}
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-green-900/20">
                                            <div className="text-[10px] font-mono text-green-800 break-all">
                                                {formatHash(tx.hash)}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

