import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { PlusCircle, Search, Tag, Info, AlertCircle, Calendar, ChevronDown } from 'lucide-react'
import QuickCategorizeModal from '../components/QuickCategorizeModal'
import Notification from '../components/Notification'

function Transactions({ refreshTrigger }) {
    const [transactions, setTransactions] = useState([])
    const [accounts, setAccounts] = useState([])
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

                const [txRes, statsRes, accRes] = await Promise.all([
                    axios.get('/api/transactions/', { params }),
                    axios.get('/api/transactions/stats', { params }),
                    axios.get('/api/accounts/')
                ])
                setTransactions(txRes.data)
                setStats(statsRes.data)
                setAccounts(accRes.data)
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

    const filteredTransactions = transactions.filter(t => {
        if (showOnlyUncategorized) return !t.category_id && !t.is_transfer
        return true
    })

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
                                <th style={{ padding: '1rem' }}>Date</th>
                                <th style={{ padding: '1rem' }}>Description</th>
                                <th style={{ padding: '1rem' }}>Category</th>
                                <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map(t => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
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
                                                <span style={{
                                                    padding: '0.25rem 0.5rem',
                                                    background: t.category_id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                                    color: t.category_id ? 'inherit' : 'var(--danger)',
                                                    borderRadius: '4px',
                                                    fontSize: '0.875rem'
                                                }}>
                                                    {t.category?.name || 'Uncategorized'}
                                                </span>
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )
                }
            </div>

            {selectedTx && (
                <QuickCategorizeModal
                    transaction={selectedTx}
                    onClose={() => setSelectedTx(null)}
                    onRuleCreated={() => setLocalRefresh(prev => prev + 1)}
                />
            )}

            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}
        </div>
    )
}

export default Transactions
