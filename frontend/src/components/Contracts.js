import React, { useState, useEffect } from 'react';
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowTopRightOnSquareIcon,
    DocumentDuplicateIcon,
    ChevronLeftIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline';
import { useScanner } from '../context/ScannerContext';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

function Contracts() {
    const {
        recentContracts,
        getRecentContracts,
        getContractsByCreator,
        getContractStats
    } = useScanner();

    const { showSuccess, showError } = useNotifications();

    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterNetwork, setFilterNetwork] = useState('all');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [contractsPerPage] = useState(20);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        loadContracts();
        loadStats();
    }, []);

    useEffect(() => {
        setContracts(recentContracts);
    }, [recentContracts]);

    const loadContracts = async () => {
        try {
            setLoading(true);
            await getRecentContracts(100);
        } catch (error) {
            showError(`Failed to load contracts: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const statsData = await getContractStats();
            setStats(statsData);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            setContracts(recentContracts);
            return;
        }

        try {
            setLoading(true);
            // If search term looks like an address, search by creator
            if (searchTerm.match(/^0x[a-fA-F0-9]{40}$/)) {
                const results = await getContractsByCreator(searchTerm);
                setContracts(results);
            } else {
                // Filter existing contracts
                const filtered = recentContracts.filter(contract =>
                    contract.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    contract.creator_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    contract.transaction_hash.toLowerCase().includes(searchTerm.toLowerCase())
                );
                setContracts(filtered);
            }
        } catch (error) {
            showError(`Search failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const filteredContracts = contracts.filter(contract => {
        if (filterNetwork !== 'all' && contract.network !== filterNetwork) {
            return false;
        }
        return true;
    });

    const sortedContracts = [...filteredContracts].sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        if (sortBy === 'created_at') {
            aValue = new Date(aValue);
            bValue = new Date(bValue);
        }

        if (sortOrder === 'asc') {
            return aValue > bValue ? 1 : -1;
        } else {
            return aValue < bValue ? 1 : -1;
        }
    });

    // Pagination
    const indexOfLastContract = currentPage * contractsPerPage;
    const indexOfFirstContract = indexOfLastContract - contractsPerPage;
    const currentContracts = sortedContracts.slice(indexOfFirstContract, indexOfLastContract);
    const totalPages = Math.ceil(sortedContracts.length / contractsPerPage);

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            showSuccess('Copied to clipboard');
        } catch (error) {
            showError('Failed to copy to clipboard');
        }
    };

    const openInExplorer = (address, network) => {
        const explorers = {
            ethereum: `https://etherscan.io/address/${address}`,
            polygon: `https://polygonscan.com/address/${address}`,
            bsc: `https://bscscan.com/address/${address}`
        };

        const url = explorers[network];
        if (url) {
            window.open(url, '_blank');
        }
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Discovered Contracts</h1>
                    <p className="text-gray-600">Browse and analyze detected smart contracts</p>
                </div>

                {stats && (
                    <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{stats.total_contracts?.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">Total Contracts</div>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="text-2xl font-bold text-gray-900">{stats.total_contracts?.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">Total Contracts</div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="text-2xl font-bold text-gray-900">{stats.unique_creators?.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">Unique Creators</div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="text-2xl font-bold text-gray-900">{stats.first_block?.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">First Block</div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="text-2xl font-bold text-gray-900">{stats.latest_block?.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">Latest Block</div>
                    </div>
                </div>
            )}

            {/* Search and Filters */}
            <div className="card">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
                    {/* Search */}
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by address, creator, or transaction hash..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                className="pl-10 input"
                            />
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <FunnelIcon className="h-5 w-5 text-gray-400" />
                            <select
                                value={filterNetwork}
                                onChange={(e) => setFilterNetwork(e.target.value)}
                                className="select"
                            >
                                <option value="all">All Networks</option>
                                <option value="ethereum">Ethereum</option>
                                <option value="polygon">Polygon</option>
                                <option value="bsc">BSC</option>
                            </select>
                        </div>

                        <select
                            value={`${sortBy}-${sortOrder}`}
                            onChange={(e) => {
                                const [field, order] = e.target.value.split('-');
                                setSortBy(field);
                                setSortOrder(order);
                            }}
                            className="select"
                        >
                            <option value="created_at-desc">Newest First</option>
                            <option value="created_at-asc">Oldest First</option>
                            <option value="block_number-desc">Block Number (High)</option>
                            <option value="block_number-asc">Block Number (Low)</option>
                            <option value="contract_size-desc">Size (Large)</option>
                            <option value="contract_size-asc">Size (Small)</option>
                        </select>

                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Contracts Table */}
            <div className="card">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Contract
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Creator
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Block
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Network
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Size
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Created
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {currentContracts.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                        {loading ? 'Loading contracts...' : 'No contracts found'}
                                    </td>
                                </tr>
                            ) : (
                                currentContracts.map((contract, index) => (
                                    <tr key={contract.address || index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 font-mono">
                                                        {contract.address?.slice(0, 10)}...{contract.address?.slice(-8)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {contract.transaction_hash?.slice(0, 10)}...
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-mono text-gray-900">
                                                {contract.creator_address?.slice(0, 10)}...{contract.creator_address?.slice(-8)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                #{contract.block_number?.toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${contract.network === 'ethereum' ? 'bg-blue-100 text-blue-800' :
                                                    contract.network === 'polygon' ? 'bg-purple-100 text-purple-800' :
                                                        contract.network === 'bsc' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-gray-100 text-gray-800'
                                                }`}>
                                                {contract.network}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {contract.contract_size ? formatBytes(contract.contract_size) : 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {contract.created_at ? formatDistanceToNow(new Date(contract.created_at), { addSuffix: true }) : 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => copyToClipboard(contract.address)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                    title="Copy address"
                                                >
                                                    <DocumentDuplicateIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => openInExplorer(contract.address, contract.network)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                    title="View in explorer"
                                                >
                                                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
                        <div className="text-sm text-gray-700">
                            Showing {indexOfFirstContract + 1} to {Math.min(indexOfLastContract, sortedContracts.length)} of {sortedContracts.length} contracts
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                <ChevronLeftIcon className="h-4 w-4" />
                            </button>

                            <span className="text-sm text-gray-700">
                                Page {currentPage} of {totalPages}
                            </span>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                <ChevronRightIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Contracts;