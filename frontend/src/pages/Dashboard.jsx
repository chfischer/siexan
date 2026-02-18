import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Calendar, ChevronDown, Filter, Tag, X, ArrowDown, Trash2 } from 'lucide-react'
import { getElementAtEvent } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
} from 'chart.js'
import { Pie, Bar } from 'react-chartjs-2'

ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    Title
)

function Dashboard({ refreshTrigger }) {
    const [summary, setSummary] = useState([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState('last_month')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [selectedCategory, setSelectedCategory] = useState(null)
    const [detailTransactions, setDetailTransactions] = useState([])
    const [loadingDetails, setLoadingDetails] = useState(false)
    const [monthlyData, setMonthlyData] = useState([])
    const [loadingMonthly, setLoadingMonthly] = useState(true)
    const chartRef = React.useRef(null)
    const barChartRef = React.useRef(null)

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
        } else if (selectedPeriod === 'all') {
            return { start: null, end: null }
        }

        const format = (d) => d ? d.toISOString().split('T')[0] : null
        return { start: format(start), end: format(end) }
    }

    useEffect(() => {
        const fetchSummary = async () => {
            setLoading(true)
            const { start, end } = getDatesForPeriod(period)

            // Don't fetch if custom is selected but dates are missing
            if (period === 'custom' && (!start || !end)) {
                setLoading(false)
                return
            }

            try {
                const res = await axios.get('/api/analytics/summary', {
                    params: { start_date: start, end_date: end }
                })
                setSummary(res.data)
            } catch (err) {
                console.error("Error fetching summary", err)
            } finally {
                setLoading(false)
            }
        }
        fetchSummary()
        setSelectedCategory(null)
    }, [refreshTrigger, period, customStart, customEnd])

    const fetchMonthly = async () => {
        setLoadingMonthly(true)
        try {
            const res = await axios.get('/api/analytics/monthly')
            setMonthlyData(res.data)
        } catch (err) {
            console.error("Error fetching monthly data", err)
        } finally {
            setLoadingMonthly(false)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this transaction?")) return
        try {
            await axios.delete(`/api/transactions/${id}`)
            // After deletion, refresh the summary and details if a category is selected
            // This will trigger the useEffects that fetch data
            setRefreshTrigger(prev => prev + 1)
            // If a category is selected, re-fetch its details
            if (selectedCategory) {
                setSelectedCategory(null) // Clear to force re-fetch
                setTimeout(() => setSelectedCategory(selectedCategory), 0)
            }
        } catch (err) {
            console.error("Error deleting transaction", err)
            alert("Failed to delete transaction")
        }
    }

    useEffect(() => {
        fetchMonthly()
    }, [refreshTrigger])

    useEffect(() => {
        const fetchDetails = async () => {
            if (!selectedCategory) return
            setLoadingDetails(true)
            const { start, end } = getDatesForPeriod(period)
            try {
                const params = { start_date: start, end_date: end, limit: 100 }
                if (selectedCategory.isMonthlyTotal) {
                    // Fetch all for this period
                } else if (selectedCategory.category === 'Uncategorized') {
                    params.is_uncategorized = true
                } else if (!selectedCategory.isMonthlyTotal) {
                    params.category_id = selectedCategory.category_id
                }
                const res = await axios.get('/api/transactions/', { params })
                setDetailTransactions(res.data)
            } catch (err) {
                console.error("Error fetching details", err)
            } finally {
                setLoadingDetails(false)
            }
        }
        fetchDetails()
    }, [selectedCategory, period, refreshTrigger]) // Added refreshTrigger here to re-fetch details after delete

    const onChartClick = (event) => {
        const element = getElementAtEvent(chartRef.current, event)
        if (element.length > 0) {
            const index = element[0].index
            setSelectedCategory(summary[index])
            // Smooth scroll to details
            setTimeout(() => {
                document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
        }
    }

    const barData = {
        labels: monthlyData.map(d => d.month),
        datasets: [
            {
                label: 'Inflow',
                data: monthlyData.map(d => d.inflow),
                backgroundColor: '#10b981',
                borderRadius: 4,
            },
            {
                label: 'Outflow',
                data: monthlyData.map(d => d.outflow),
                backgroundColor: '#ef4444',
                borderRadius: 4,
            }
        ]
    }

    const barOptions = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: { color: 'white', font: { size: 12 } }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
            }
        },
        onClick: (e, elements) => {
            if (elements.length > 0) {
                const index = elements[0].index
                const item = monthlyData[index]
                const [year, month] = item.month.split('-')

                // Set custom range for that month
                const start = `${year}-${month}-01`
                const lastDay = new Date(year, month, 0).getDate()
                const end = `${year}-${month}-${lastDay}`

                setCustomStart(start)
                setCustomEnd(end)
                setPeriod('custom')
                setSelectedCategory({ category: `Transactions for ${item.month}`, isMonthlyTotal: true })

                setTimeout(() => {
                    document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' })
                }, 100)
            }
        }
    }

    const pieData = {
        labels: (summary.categories || []).map(s => s.category),
        datasets: [
            {
                data: (summary.categories || []).map(s => s.total),
                backgroundColor: [
                    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
                ],
                borderWidth: 0,
            },
        ],
    }

    const categories = summary.categories || []
    const totalIncome = summary.total_income || 0
    const totalSpending = summary.total_spending || 0

    return (
        <div className="dashboard-page">
            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1>Analytics Overview</h1>
                    <p className="text-muted">Tracking your financial health and spending patterns.</p>
                </div>

                <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                        <Calendar size={18} />
                        <span className="small" style={{ fontWeight: 600 }}>Period:</span>
                    </div>

                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="form-control-minimal"
                    >
                        <option value="all">All Time</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="custom">Custom Range</option>
                    </select>

                    {period === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem', paddingLeft: '0.5rem', borderLeft: '1px solid var(--border)' }}>
                            <input
                                type="date"
                                className="date-input"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                            />
                            <span className="text-muted">to</span>
                            <input
                                type="date"
                                className="date-input"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </header>

            {!loadingMonthly && monthlyData.length > 0 && (
                <div className="glass-card" style={{ marginBottom: '2rem', height: '350px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ margin: 0 }}>Cash Flow Trend</h2>
                        <span className="text-muted small">Click bars to filter by month</span>
                    </div>
                    <div style={{ height: '260px' }}>
                        <Bar data={barData} options={barOptions} />
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner"></div>
                </div>
            ) : categories.length === 0 && totalIncome === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <h2 style={{ color: 'var(--text-muted)' }}>No data for this period</h2>
                    <p style={{ marginTop: '1rem' }}>Adjust your filter or upload more transactions.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                    <div className="glass-card">
                        <h2 style={{ marginBottom: '2rem' }}>Spending by Category</h2>
                        <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
                            <Pie
                                ref={chartRef}
                                data={pieData}
                                onClick={onChartClick}
                                options={{
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'right', labels: { color: 'white', padding: 20 } }
                                    },
                                    onClick: (e, elements) => {
                                        if (elements.length > 0) {
                                            const index = elements[0].index
                                            setSelectedCategory(categories[index])
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className="glass-card">
                        <h2 style={{ marginBottom: '2rem' }}>Quick Stats</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Income</p>
                                    <h3 style={{ fontSize: '1.75rem', color: 'var(--success)', marginTop: '0.25rem' }}>${totalIncome.toFixed(2)}</h3>
                                </div>
                                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Expenses</p>
                                    <h3 style={{ fontSize: '1.75rem', color: 'var(--danger)', marginTop: '0.25rem' }}>${totalSpending.toFixed(2)}</h3>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.1)', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Net Cash Flow</p>
                                <h3 style={{ fontSize: '2rem', color: (totalIncome - totalSpending) >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '0.25rem' }}>
                                    ${(totalIncome - totalSpending).toFixed(2)}
                                </h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {categories.map(s => (
                                    <div key={s.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                                            <span>{s.category}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 600 }}>${s.total.toFixed(2)}</div>
                                            <div className="x-small text-muted">{((s.total / totalSpending) * 100).toFixed(1)}%</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedCategory && (
                <div id="details-section" style={{ marginTop: '2.5rem' }} className="glass-card animate-slide-up">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                <ArrowDown size={20} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0 }}>{selectedCategory.category} {selectedCategory.isMonthlyTotal ? '' : 'Details'}</h2>
                                <p className="text-muted small">Showing transactions for selected period</p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedCategory(null)} className="btn-icon" style={{ padding: '0.5rem' }}>
                            <X size={20} />
                        </button>
                    </div>

                    {loadingDetails ? (
                        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                                        <th style={{ padding: '1rem' }}>Date</th>
                                        <th style={{ padding: '1rem' }}>Description</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detailTransactions.map(t => (
                                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '1rem' }}>{t.date}</td>
                                            <td style={{ padding: '1rem' }}>{t.description}</td>
                                            <td style={{
                                                padding: '1rem',
                                                textAlign: 'right',
                                                color: t.amount < 0 ? 'var(--danger)' : 'var(--success)',
                                                fontWeight: 600
                                            }}>
                                                ${t.amount.toFixed(2)}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '1rem' }}>
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
                                    {detailTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                No specific transactions found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .form-control-minimal {
                    background: none;
                    border: none;
                    color: white;
                    font-weight: 500;
                    outline: none;
                    cursor: pointer;
                    padding: 0.25rem;
                }
                .date-input {
                    background: var(--bg-deep);
                    border: 1px solid var(--border);
                    color: white;
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.25rem;
                    font-size: 0.75rem;
                    outline: none;
                }
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(99, 102, 241, 0.1);
                    border-top-color: var(--primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .small { font-size: 0.875rem; }
                .x-small { font-size: 0.75rem; }
                .text-muted { color: var(--text-muted); }
            `}} />
        </div>
    )
}

export default Dashboard
