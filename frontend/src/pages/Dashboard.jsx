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
    const [allCategories, setAllCategories] = useState([])
    const [loadingMonthly, setLoadingMonthly] = useState(true)
    const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0)
    const [explodedBars, setExplodedBars] = useState({}) // { '2024-01_inflow': [categories], ... }
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
            setLocalRefreshTrigger(prev => prev + 1)
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
        const fetchCategories = async () => {
            try {
                const res = await axios.get('/api/categories/')
                setAllCategories(res.data)
            } catch (err) {
                console.error("Error fetching categories", err)
            }
        }
        fetchCategories()
    }, [])

    useEffect(() => {
        fetchSummary()
        fetchMonthly()
        setSelectedCategory(null) // Reset selected category when period changes
    }, [period, customStart, customEnd, refreshTrigger, localRefreshTrigger])

    useEffect(() => {
        const fetchDetails = async () => {
            setLoadingDetails(true)
            const { start, end } = getDatesForPeriod(period)
            try {
                const params = { start_date: start, end_date: end, limit: 5000 }
                if (selectedCategory) {
                    if (selectedCategory.isMonthlyTotal) {
                        if (selectedCategory.category_id) {
                            params.category_id = selectedCategory.category_id
                        } else if (selectedCategory.isUncategorized) {
                            params.is_uncategorized = true
                        } else if (selectedCategory.type === 'inflow') {
                            params.min_amount = 0.01
                        } else if (selectedCategory.type === 'outflow') {
                            params.max_amount = -0.01
                        }
                    } else if (selectedCategory.category === 'Uncategorized') {
                        params.is_uncategorized = true
                    } else {
                        params.category_id = selectedCategory.category_id
                    }
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
    }, [selectedCategory, period, refreshTrigger, localRefreshTrigger])

    const handleUpdateCategory = async (txId, categoryId) => {
        try {
            await axios.patch(`/api/transactions/${txId}`, { category_id: categoryId })
            setLocalRefreshTrigger(prev => prev + 1)
        } catch (err) {
            console.error("Error updating transaction category", err)
        }
    }

    // Helper to organize categories hierarchically
    const getHierarchicalCategories = () => {
        const parents = allCategories.filter(c => !c.parent_id)
        const children = allCategories.filter(c => c.parent_id)

        const result = []
        const process = (cats, level = 0) => {
            cats.sort((a, b) => a.name.localeCompare(b.name))
            cats.forEach(cat => {
                result.push({ ...cat, level })
                const subCats = children.filter(c => c.parent_id === cat.id)
                if (subCats.length > 0) {
                    process(subCats, level + 1)
                }
            })
        }
        process(parents)
        return result
    }

    const hierarchicalCategories = getHierarchicalCategories()

    const onChartClick = (event) => {
        const element = getElementAtEvent(chartRef.current, event)
        if (element.length > 0) {
            const index = element[0].index
            const pieCategories = [...(summary.spending_categories || [])].sort((a, b) => b.total - a.total)
            setSelectedCategory(pieCategories[index])
            setTimeout(() => {
                document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
        }
    }

    const handleSelectBar = (event, elements) => {
        if (elements.length > 0) {
            const chart = barChartRef.current
            if (!chart) return

            const element = elements[0]
            const index = element.index
            const datasetIndex = element.datasetIndex
            const dataset = chart.data.datasets[datasetIndex]
            const item = monthlyData[index]
            const [year, month] = item.month.split('-')

            // Set custom range for that month
            const start = `${year}-${month}-01`
            const lastDay = new Date(year, month, 0).getDate()
            const end = `${year}-${month}-${lastDay}`

            setCustomStart(start)
            setCustomEnd(end)
            setPeriod('custom')

            const type = dataset.stack // 'inflow' or 'outflow'
            const key = `${item.month}_${type}`
            const exploded = explodedBars[key]

            let categoryLabel = `${type === 'inflow' ? 'Inflow' : 'Outflow'} for ${item.month}`
            let categoryId = null
            let isUncategorized = false

            // If it's a category dataset (label exists and is not just "Inflow"/"Outflow")
            if (exploded && dataset.label !== 'Inflow' && dataset.label !== 'Outflow') {
                // Extract "Food" from "Food (In)"
                const catName = dataset.label.replace(' (In)', '').replace(' (Out)', '')
                categoryLabel = `${catName} in ${item.month}`
                const catObj = exploded.find(c => c.category === catName)
                if (catObj) {
                    categoryId = catObj.category_id
                    if (!categoryId) isUncategorized = true
                }
            }

            setSelectedCategory({
                category: categoryLabel,
                isMonthlyTotal: true,
                type: type,
                category_id: categoryId,
                isUncategorized: isUncategorized
            })
        }
    }

    const handleRightClick = async (event, elements) => {
        event.preventDefault()
        if (elements && elements.length > 0) {
            const chart = barChartRef.current
            if (!chart) return

            const element = elements[0]
            const index = element.index
            const datasetIndex = element.datasetIndex
            const dataset = chart.data.datasets[datasetIndex]
            const item = monthlyData[index]
            const type = dataset.stack // 'inflow' or 'outflow'
            const key = `${item.month}_${type}`

            if (explodedBars[key]) {
                // Toggle off
                const newExploded = { ...explodedBars }
                delete newExploded[key]
                setExplodedBars(newExploded)
                return
            }

            const [year, month] = item.month.split('-')
            const start = `${year}-${month}-01`
            const lastDay = new Date(year, month, 0).getDate()
            const end = `${year}-${month}-${lastDay}`

            try {
                const res = await axios.get('/api/analytics/summary', {
                    params: { start_date: start, end_date: end }
                })
                const categories = type === 'inflow' ? res.data.income_categories : res.data.spending_categories
                setExplodedBars(prev => ({ ...prev, [key]: categories }))
            } catch (err) {
                console.error("Error exploding bar", err)
            }
        }
    }

    // Generate bar data with explosions
    const categoryColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

    // Find all unique categories across all exploded bars to create datasets
    const allExplodedCategories = new Set()
    Object.values(explodedBars).forEach(cats => {
        cats.forEach(c => allExplodedCategories.add(c.category))
    })
    const sortedCategories = Array.from(allExplodedCategories).sort()

    const datasets = []

    // 1. Base Inflow (only for non-exploded)
    datasets.push({
        label: 'Inflow',
        data: monthlyData.map(d => explodedBars[`${d.month}_inflow`] ? 0 : d.inflow),
        backgroundColor: '#10b981',
        borderRadius: 4,
        stack: 'inflow'
    })

    // 2. Base Outflow (only for non-exploded)
    datasets.push({
        label: 'Outflow',
        data: monthlyData.map(d => explodedBars[`${d.month}_outflow`] ? 0 : d.outflow),
        backgroundColor: '#ef4444',
        borderRadius: 4,
        stack: 'outflow'
    })

    // 3. Category datasets for Inflow
    sortedCategories.forEach((catName, idx) => {
        const color = categoryColors[idx % categoryColors.length]
        datasets.push({
            label: `${catName} (In)`,
            data: monthlyData.map(d => {
                const exploded = explodedBars[`${d.month}_inflow`]
                if (!exploded) return 0
                const cat = exploded.find(c => c.category === catName)
                return cat ? cat.total : 0
            }),
            backgroundColor: color,
            stack: 'inflow',
            hidden: false // We could hide them from legend if too many
        })
    })

    // 4. Category datasets for Outflow
    sortedCategories.forEach((catName, idx) => {
        const color = categoryColors[idx % categoryColors.length]
        datasets.push({
            label: `${catName} (Out)`,
            data: monthlyData.map(d => {
                const exploded = explodedBars[`${d.month}_outflow`]
                if (!exploded) return 0
                const cat = exploded.find(c => c.category === catName)
                return cat ? cat.total : 0
            }),
            backgroundColor: color,
            stack: 'outflow',
            hidden: false
        })
    })

    const barData = {
        labels: monthlyData.map(d => d.month),
        datasets: datasets
    }

    const barOptions = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
                position: 'top',
                labels: { color: 'white', font: { size: 12 } }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 },
                callbacks: {
                    label: (context) => {
                        let label = context.dataset.label || ''
                        if (label) label += ': '
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y)
                        }
                        return label
                    }
                }
            }
        },
        scales: {
            x: {
                stacked: true,
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
            },
            y: {
                stacked: true,
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
            }
        },
        onClick: handleSelectBar,
        // Enable context menu to handle right click
        onHover: (event, chartElement) => {
            event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
        }
    }

    const pieCategories = [...(summary.spending_categories || [])].sort((a, b) => b.total - a.total)

    const pieData = {
        labels: pieCategories.map(s => s.category),
        datasets: [
            {
                data: pieCategories.map(s => s.total),
                backgroundColor: [
                    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#3b82f6', '#14b8a6'
                ],
                borderWidth: 0,
            },
        ],
    }

    const categories = summary.spending_categories || []
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <h2 style={{ margin: 0 }}>Cash Flow Trend</h2>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <span className="badge-hint">Left-click to filter</span>
                                <span className="badge-hint">Right-click to split</span>
                            </div>
                        </div>
                        <span className="text-muted small">Showing last 12 months</span>
                    </div>
                    <div style={{ height: '260px' }}>
                        <Bar
                            data={barData}
                            options={barOptions}
                            onContextMenu={(e) => {
                                const chart = barChartRef.current
                                if (!chart) return
                                const elements = chart.getElementsAtEventForMode(e.nativeEvent, 'nearest', { intersect: true }, true)
                                handleRightClick(e.nativeEvent, elements)
                            }}
                            ref={barChartRef}
                        />
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
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
                                    onHover: (event, chartElement) => {
                                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div id="details-section" style={{ marginTop: '2.5rem' }} className="glass-card animate-slide-up">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                            <ArrowDown size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0 }}>
                                {selectedCategory ? selectedCategory.category : 'All Transactions'}
                                {selectedCategory && !selectedCategory.isMonthlyTotal ? ' Details' : ''}
                            </h2>
                            <p className="text-muted small">
                                {selectedCategory ? 'Showing transactions for selected filter' : 'Showing all transactions for selected period'}
                            </p>
                        </div>
                    </div>
                    {selectedCategory && (
                        <button onClick={() => setSelectedCategory(null)} className="btn-icon" style={{ padding: '0.5rem' }}>
                            <X size={20} />
                        </button>
                    )}
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
                                    <th style={{ padding: '1rem' }}>Category</th>
                                    <th style={{ padding: '1rem' }}>Description</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailTransactions.map(t => (
                                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem' }}>{t.date}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {t.is_transfer && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{
                                                            padding: '0.1rem 0.4rem',
                                                            background: 'rgba(99, 102, 241, 0.2)',
                                                            color: 'var(--primary-light)',
                                                            borderRadius: '10px',
                                                            fontSize: '0.65rem',
                                                            border: '1px solid var(--primary)',
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            Transfer
                                                        </span>
                                                        {t.to_account && (
                                                            <span style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                ↳ {t.to_account.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <select
                                                    value={t.category_id || ''}
                                                    onChange={(e) => handleUpdateCategory(t.id, e.target.value ? parseInt(e.target.value) : null)}
                                                    style={{
                                                        background: t.is_transfer ? 'transparent' : 'rgba(99, 102, 241, 0.1)',
                                                        border: t.is_transfer ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '0.25rem',
                                                        color: t.is_transfer ? 'var(--text-muted)' : 'var(--primary)',
                                                        fontWeight: 500,
                                                        fontSize: '0.875rem',
                                                        outline: 'none',
                                                        cursor: 'pointer',
                                                        width: '100%',
                                                        maxWidth: '180px'
                                                    }}
                                                >
                                                    <option value="">Uncategorized</option>
                                                    {hierarchicalCategories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>
                                                            {'\u00A0'.repeat(cat.level * 3)}
                                                            {cat.level > 0 ? '↳ ' : ''}
                                                            {cat.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </td>
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
                .badge-hint {
                    font-size: 0.65rem;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 0.2rem 0.5rem;
                    border-radius: 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: var(--text-muted);
                    font-weight: 500;
                }
            `}} />
        </div>
    )
}

export default Dashboard
