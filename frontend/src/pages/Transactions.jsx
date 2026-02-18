import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { PlusCircle, Search, Tag, Info, AlertCircle, Calendar, ChevronDown, ArrowUp, ArrowDown, ArrowUpDown, Trash2, Zap, User } from 'lucide-react'
import QuickCategorizeModal from '../components/QuickCategorizeModal'
import Notification from '../components/Notification'

function Transactions({ refreshTrigger }) {
    const [transactions, setTransactions] = useState([])
    const [accounts, setAccounts] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedTx, setSelectedTx] = useState(null)
    const [selectedAccountId, setSelectedAccountId] = useState('')
    const [stats, setStats] = useState({ total: 0, uncategorized: 0 })
    const [notification, setNotification] = useState(null)
    const [localRefresh, setLocalRefresh] = useState(0)
    const [showOnlyUncategorized, setShowOnlyUncategorized] = useState(false)
    const [period, setPeriod] = useState('last_month')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
    const [filters, setFilters] = useState({ id: '', description: '', category: '', amount: '' })
    const [selectedIds, setSelectedIds] = useState([])

    const getDatesForPeriod = (selectedPeriod) => {
        const now = new Date()
        let start = null
        let end = null

        if (selectedPeriod === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1)
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        } else if (selectedPeriod === 'last_month') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            end = new Date(now.getFullYear(), now.getMonth(), 0)
        } else if (selectedPeriod === 'custom') {
            return { start: customStart, end: customEnd }
        }

        const format = (d) => d ? d.toISOString().split('T')[0] : null
        return { start: format(start), end: format(end) }
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { start, end } = getDatesForPeriod(period)
                if (period === 'custom' && (!start || !end)) return

                const params = { start_date: start, end_date: end }
                if (selectedAccountId) params.account_id = selectedAccountId

                const [txRes, statsRes, accRes, catRes] = await Promise.all([
                    axios.get('/api/transactions/', { params }),
                    axios.get('/api/transactions/stats', { params }),
                    axios.get('/api/accounts/'),
                    axios.get('/api/categories/')
                ])
                setTransactions(txRes.data)
                setStats(statsRes.data)
                setAccounts(accRes.data)
                setCategories(catRes.data)
            } catch (err) {
                console.error("Error fetching transactions", err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [refreshTrigger, localRefresh, selectedAccountId, period, customStart, customEnd])

    const handleReCategorize = async () => {
        try {
            const res = await axios.post('/api/rules/re-categorize/')
            let msg = res.data.message
            let type = 'success'
            if (res.data.failed_rules && res.data.failed_rules.length > 0) {
                msg += "\n\nWarning: Some rules were skipped due to invalid regex:\n" +
                    res.data.failed_rules.map(r => `• ${r.pattern}: ${r.error}`).join('\n')
                type = 'info'
            }
            setNotification({ type, message: msg })
            setLocalRefresh(prev => prev + 1)
        } catch (err) {
            console.error("Failed to re-categorize", err)
            setNotification({ type: 'error', message: "Failed to re-categorize transactions." })
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this transaction?")) return
        try {
            await axios.delete(`/api/transactions/${id}`)
            setNotification({ type: 'success', message: "Transaction deleted" })
            setLocalRefresh(prev => prev + 1)
        } catch (err) {
            setNotification({ type: 'error', message: "Failed to delete transaction" })
        }
    }

    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedIds.length} select transactions?`)) return
        try {
            await axios.delete('/api/transactions/bulk/', { data: selectedIds })
            setNotification({ type: 'success', message: "Transactions deleted" })
            setSelectedIds([])
            setLocalRefresh(prev => prev + 1)
        } catch (err) {
            setNotification({ type: 'error', message: "Failed to delete transactions" })
        }
    }

    const handleCategoryChange = async (transactionId, categoryId) => {
        if (categoryId === 'new') {
            const name = window.prompt("Enter new category name:")
            if (!name) return
            try {
                const res = await axios.post('/api/categories/', { name })
                const newCat = res.data
                setCategories([...categories, newCat])
                await axios.put(`/api/transactions/${transactionId}`, { category_id: newCat.id })
                setLocalRefresh(prev => prev + 1)
            } catch (err) {
                console.error("Failed to create/set category", err)
                setNotification({ type: 'error', message: "Failed to create category" })
            }
        } else {
            try {
                await axios.put(`/api/transactions/${transactionId}`, {
                    category_id: categoryId === '' ? null : parseInt(categoryId)
                })
                setLocalRefresh(prev => prev + 1)
            } catch (err) {
                console.error("Failed to update category", err)
                setNotification({ type: 'error', message: "Failed to update category" })
            }
        }
    }

    const handleSort = (key) => {
        let direction = 'asc'
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const getCategoryPath = (catId) => {
        const cat = categories.find(c => c.id === catId)
        if (!cat) return ''
        if (!cat.parent_id) return cat.name
        return `${getCategoryPath(cat.parent_id)} / ${cat.name}`
    }

    const sortedCategories = [...categories]
        .map(cat => ({ ...cat, fullPath: getCategoryPath(cat.id) }))
        .sort((a, b) => a.fullPath.localeCompare(b.fullPath))

    const filteredTransactions = transactions
        .filter(t => {
            if (showOnlyUncategorized && (t.category_id || t.is_transfer)) return false

            // Header filters
            if (filters.id && !t.id.toString().includes(filters.id)) return false
            if (filters.description && !t.description.toLowerCase().includes(filters.description.toLowerCase())) return false
            if (filters.category) {
                const catName = (t.is_transfer ? 'Transfer' : (getCategoryPath(t.category_id) || 'Uncategorized')).toLowerCase()
                if (!catName.includes(filters.category.toLowerCase())) return false
            }
            if (filters.amount && !t.amount.toString().includes(filters.amount)) return false

            return true
        })
        .sort((a, b) => {
            let valA = a[sortConfig.key]
            let valB = b[sortConfig.key]

            // Special handling for category name
            if (sortConfig.key === 'category') {
                valA = a.is_transfer ? 'Transfer' : (getCategoryPath(a.category_id) || 'Uncategorized')
                valB = b.is_transfer ? 'Transfer' : (getCategoryPath(b.category_id) || 'Uncategorized')
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })

    const renderSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1>Transactions</h1>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', borderRadius: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                            Total: <strong>{stats.total}</strong>
                        </span>
                        <span style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', borderRadius: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
                            Uncategorized: <strong>{stats.uncategorized}</strong>
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div className="period-selector-minimal" style={{ position: 'relative' }}>
                        <Calendar size={16} className="text-muted" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <select
                            className="form-control-minimal"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            style={{
                                paddingLeft: '2.75rem',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border)',
                                color: 'white',
                                borderRadius: '2rem',
                                height: '38px',
                                outline: 'none'
                            }}
                        >
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="all">All Time</option>
                            <option value="custom">Custom Range</option>
                        </select>
                        <ChevronDown size={14} className="text-muted" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {period === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="date"
                                className="form-control-minimal"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem' }}
                            />
                            <span className="text-muted">to</span>
                            <input
                                type="date"
                                className="form-control-minimal"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'white', borderRadius: '2rem', padding: '0.4rem 1rem' }}
                            />
                        </div>
                    )}

                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>

                    <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="form-control-minimal"
                        style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            color: 'white',
                            padding: '0.4rem 1rem',
                            borderRadius: '2rem',
                            outline: 'none',
                            fontSize: '0.875rem'
                        }}
                    >
                        <option value="">All Accounts</option>
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                        ))}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input
                            type="checkbox"
                            checked={showOnlyUncategorized}
                            onChange={(e) => setShowOnlyUncategorized(e.target.checked)}
                            style={{ width: '16px', height: '16px' }}
                        />
                        Show only uncategorized
                    </label>
                    <button
                        onClick={handleReCategorize}
                        className="btn-primary"
                        style={{ background: 'var(--success)', borderColor: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Tag size={18} /> Re-apply Rules
                    </button>

                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="btn-primary"
                            style={{ background: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Trash2 size={18} /> Delete Selected ({selectedIds.length})
                        </button>
                    )}
                </div>
            </div>
            <div className="glass-card">
                {loading ? (
                    <p>Loading...</p>
                ) : filteredTransactions.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No transactions found{showOnlyUncategorized ? ' matching filter' : ''}.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '1rem', width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length === filteredTransactions.length && filteredTransactions.length > 0}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedIds(filteredTransactions.map(t => t.id))
                                            else setSelectedIds([])
                                        }}
                                    />
                                </th>
                                <th style={{ padding: '1rem', width: '80px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => handleSort('id')}>
                                            {renderSortIcon('id')} ID
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="ID..."
                                            className="header-filter"
                                            value={filters.id}
                                            onChange={(e) => setFilters({ ...filters, id: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', width: '120px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => handleSort('date')}>
                                        Date {renderSortIcon('date')}
                                    </div>
                                </th>
                                <th style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => handleSort('description')}>
                                            Description {renderSortIcon('description')}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter..."
                                            className="header-filter"
                                            value={filters.description}
                                            onChange={(e) => setFilters({ ...filters, description: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => handleSort('category')}>
                                            Category {renderSortIcon('category')}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter..."
                                            className="header-filter"
                                            value={filters.category}
                                            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => handleSort('amount')}>
                                            {renderSortIcon('amount')} Amount
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Filter..."
                                            className="header-filter"
                                            style={{ textAlign: 'right' }}
                                            value={filters.amount}
                                            onChange={(e) => setFilters({ ...filters, amount: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </th>
                                <th style={{ padding: '1rem', width: '80px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map(t => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(t.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedIds([...selectedIds, t.id])
                                                else setSelectedIds(selectedIds.filter(id => id !== t.id))
                                            }}
                                        />
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{t.id}</td>
                                    <td style={{ padding: '1rem' }}>{t.date}</td>
                                    <td style={{ padding: '1rem' }}>{t.description}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {t.is_transfer ? (
                                                <span style={{
                                                    padding: '0.25rem 0.5rem',
                                                    background: 'rgba(16, 185, 129, 0.1)',
                                                    color: 'var(--success)',
                                                    borderRadius: '4px',
                                                    fontSize: '0.875rem',
                                                    border: '1px solid var(--success)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }}>
                                                    Transfer
                                                </span>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', maxWidth: '210px' }}>
                                                    <div title={t.is_manual ? "Manually categorized" : "Automatically categorized"} style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '50%',
                                                        background: t.is_manual ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                        color: t.is_manual ? 'var(--warning)' : 'var(--success)',
                                                        flexShrink: 0
                                                    }}>
                                                        {t.is_manual ? <User size={12} /> : <Zap size={12} />}
                                                    </div>
                                                    <select
                                                        value={t.category_id || ''}
                                                        onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                                                        style={{
                                                            padding: '0.25rem 0.5rem',
                                                            background: t.category_id ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                                                            color: t.category_id ? 'var(--text-bright)' : 'var(--danger)',
                                                            borderRadius: '4px',
                                                            fontSize: '0.875rem',
                                                            border: t.category_id ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(239, 68, 68, 0.2)',
                                                            flexGrow: 1,
                                                            cursor: 'pointer',
                                                            outline: 'none',
                                                            appearance: 'none',
                                                            WebkitAppearance: 'none'
                                                        }}
                                                    >
                                                        <option value="" style={{ background: 'var(--bg-card)', color: 'var(--danger)' }}>Uncategorized</option>
                                                        {sortedCategories.map(cat => (
                                                            <option key={cat.id} value={cat.id} style={{ background: 'var(--bg-card)', color: 'var(--text-bright)' }}>
                                                                {cat.fullPath}
                                                            </option>
                                                        ))}
                                                        <option value="new" style={{ background: 'var(--bg-card)', color: 'var(--primary)', fontWeight: 'bold' }}>+ New Category...</option>
                                                    </select>
                                                </div>
                                            )}
                                            {!t.category_id && !t.is_transfer && (
                                                <button
                                                    onClick={() => setSelectedTx(t)}
                                                    className="btn-icon"
                                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                                    title="Create categorization rule"
                                                >
                                                    <PlusCircle size={14} />
                                                </button>
                                            )}
                                        </div>
                                        {t.labels && t.labels.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.4rem' }}>
                                                {t.labels.map(lbl => (
                                                    <span key={lbl.id} style={{
                                                        padding: '0.1rem 0.4rem',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        color: lbl.color,
                                                        borderRadius: '3px',
                                                        fontSize: '0.7rem',
                                                        border: `1px solid ${lbl.color}44`,
                                                        fontWeight: 500
                                                    }}>
                                                        {lbl.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{
                                        padding: '1rem',
                                        textAlign: 'right',
                                        color: t.amount < 0 ? 'var(--danger)' : 'var(--success)',
                                        fontWeight: 600
                                    }}>
                                        {t.amount.toFixed(2)}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleDelete(t.id)}
                                            className="btn-icon"
                                            style={{ color: 'var(--text-muted)', opacity: 0.5 }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )
                }
            </div>

            {
                selectedTx && (
                    <QuickCategorizeModal
                        transaction={selectedTx}
                        onClose={() => setSelectedTx(null)}
                        onRuleCreated={() => setLocalRefresh(prev => prev + 1)}
                    />
                )
            }

            {
                notification && (
                    <Notification
                        type={notification.type}
                        message={notification.message}
                        onClose={() => setNotification(null)}
                    />
                )
            }

            <style dangerouslySetInnerHTML={{
                __html: `
                .header-filter {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--border);
                    border-radius: 4px;
                    color: white;
                    padding: 0.2rem 0.5rem;
                    font-size: 0.75rem;
                    width: 100%;
                    outline: none;
                }
                .header-filter:focus {
                    border-color: var(--primary);
                    background: rgba(255, 255, 255, 0.1);
                }
            `}} />
        </div >
    )
}

export default Transactions
