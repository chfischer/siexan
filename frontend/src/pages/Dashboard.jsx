import React, { useState, useEffect, useMemo } from 'react'
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
import ChartDataLabels from 'chartjs-plugin-datalabels'

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
    const [drilledCategoryId, setDrilledCategoryId] = useState(null)
    const [individualExplodedIds, setIndividualExplodedIds] = useState(new Set())
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
    const [accountSpending, setAccountSpending] = useState([])
    const accountChartRef = React.useRef(null)
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

    const fetchAccountSpending = async () => {
        const { start, end } = getDatesForPeriod(period)
        if (period === 'custom' && (!start || !end)) return
        try {
            const res = await axios.get('/api/analytics/spending-by-account', {
                params: { start_date: start, end_date: end }
            })
            setAccountSpending(res.data)
        } catch (err) {
            console.error("Error fetching account spending", err)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this transaction?")) return
        try {
            await axios.delete(`/api/transactions/${id}`)
            setLocalRefreshTrigger(prev => prev + 1)
        } catch (err) {
            console.error("Failed to delete", err)
        }
    }

    const handleUpdateCategory = async (txId, categoryId) => {
        try {
            await axios.patch(`/api/transactions/${txId}`, { category_id: categoryId })
            setLocalRefreshTrigger(prev => prev + 1)
        } catch (err) {
            console.error("Failed to update category", err)
        }
    }

    useEffect(() => {
        const fetchCats = async () => {
            try {
                const res = await axios.get('/api/categories/')
                setAllCategories(res.data)
            } catch (err) {
                console.error("Error fetching categories", err)
            }
        }
        fetchCats()
    }, [refreshTrigger, localRefreshTrigger])

    useEffect(() => {
        fetchSummary()
        fetchMonthly()
        fetchAccountSpending()
    }, [period, customStart, customEnd, refreshTrigger, localRefreshTrigger])

    useEffect(() => {
        const fetchDetails = async () => {
            setLoadingDetails(true)
            const { start, end } = getDatesForPeriod(period)
            try {
                const params = new URLSearchParams()
                params.append('start_date', start || '')
                params.append('end_date', end || '')
                params.append('limit', 5000)
                params.append('is_transfer', 0)

                if (selectedCategory) {
                    if (selectedCategory.isMonthlyTotal) {
                        if (selectedCategory.category_id) {
                            params.append('category_id', selectedCategory.category_id)
                        } else if (selectedCategory.isUncategorized) {
                            params.append('is_uncategorized', true)
                        } else if (selectedCategory.type === 'inflow') {
                            params.append('min_amount', 0.01)
                        } else if (selectedCategory.type === 'outflow') {
                            params.append('max_amount', -0.01)
                        }
                    } else if (selectedCategory.isUncategorized) {
                        params.append('is_uncategorized', true)
                    } else {
                        const getAllDescendants = (parentId) => {
                            let ids = [parentId]
                            const children = allCategories.filter(c => c.parent_id === parentId)
                            children.forEach(child => {
                                ids = [...ids, ...getAllDescendants(child.id)]
                            })
                            return ids
                        }
                        const ids = getAllDescendants(selectedCategory.category_id || selectedCategory.id)
                        ids.forEach(id => params.append('category_ids', id))
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
    }, [selectedCategory, period, customStart, customEnd, refreshTrigger, localRefreshTrigger, allCategories])

    const getProcessedSpending = () => {
        const cats = summary?.spending_categories || []
        if (cats.length === 0) return []

        const currentParentId = drilledCategoryId
        const palette = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#3b82f6', '#14b8a6']
        
        const getImmediateChildren = (parentId) => {
            const childrenMap = {}
            cats.forEach(c => {
                if (!c.category_id) return
                
                const getChildOf = (catId, targetParentId) => {
                    const cat = allCategories.find(x => x.id === catId)
                    if (!cat) return null
                    if (cat.parent_id === targetParentId) return cat
                    if (!cat.parent_id) return null
                    return getChildOf(cat.parent_id, targetParentId)
                }

                const child = getChildOf(c.category_id, parentId)
                if (child) {
                    if (!childrenMap[child.id]) {
                        childrenMap[child.id] = { ...child, rollupTotal: 0 }
                    }
                    childrenMap[child.id].rollupTotal += c.total
                }
            })
            return Object.values(childrenMap)
        }

        const adjustColor = (hex, amount) => {
            return '#' + hex.replace(/^#/, '').replace(/../g, hex => ('0' + Math.min(255, Math.max(0, parseInt(hex, 16) + amount)).toString(16)).slice(-2));
        }

        const buildLevel = (parentId, baseColor = null, index = 0) => {
            const finalItems = []
            
            if (parentId === null) {
                const uncat = cats.find(c => c.category === 'Uncategorized')
                if (uncat) {
                    finalItems.push({ ...uncat, category_id: null, rollupTotal: uncat.total, isUncategorized: true, color: '#94a3b8' })
                }
            }

            const children = getImmediateChildren(parentId).sort((a, b) => b.rollupTotal - a.rollupTotal)
            
            children.forEach((child, idx) => {
                const itemColor = baseColor || palette[idx % palette.length]
                const displayColor = baseColor ? adjustColor(baseColor, (idx + 1) * 20) : itemColor

                if (individualExplodedIds.has(child.id)) {
                    const subItems = buildLevel(child.id, itemColor, idx)
                    if (subItems.length > 0) {
                        finalItems.push(...subItems)
                    } else {
                        finalItems.push({ ...child, color: displayColor })
                    }
                } else {
                    finalItems.push({ ...child, color: displayColor })
                }
            })
            
            return finalItems
        }

        return buildLevel(currentParentId)
    }

    const processedSpending = getProcessedSpending()

    const getDrillPath = () => {
        if (!drilledCategoryId) return []
        const path = []
        let current = allCategories.find(c => c.id === drilledCategoryId)
        while (current) {
            path.unshift(current)
            current = allCategories.find(c => c.id === current.parent_id)
        }
        return path
    }

    const drillPath = getDrillPath()

    const pieData = {
        labels: processedSpending.map(s => s.name || s.category),
        datasets: [
            {
                data: processedSpending.map(s => s.rollupTotal),
                backgroundColor: processedSpending.map(s => s.color),
                borderWidth: 0,
            },
        ],
    }

    const handlePieRightClick = (event) => {
        event.preventDefault()
        const chart = chartRef.current
        if (!chart) return

        const elements = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true)
        if (elements.length > 0) {
            const index = elements[0].index
            const clicked = processedSpending[index]
            
            if (clicked.id) {
                const newExploded = new Set(individualExplodedIds)
                if (newExploded.has(clicked.id)) {
                    newExploded.delete(clicked.id)
                } else {
                    const hasChildren = allCategories.some(c => c.parent_id === clicked.id)
                    if (hasChildren) newExploded.add(clicked.id)
                }
                setIndividualExplodedIds(newExploded)
            }
        }
    }

    const totalIncome = summary?.total_income || 0
    const totalSpending = summary?.total_spending || 0

    const categoryColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#3b82f6', '#14b8a6']

    const sortedCategories = useMemo(() => {
        const cats = new Set()
        Object.values(explodedBars).forEach(list => {
            list.forEach(c => cats.add(c.category))
        })
        return Array.from(cats).sort()
    }, [explodedBars])

    const datasets = []

    datasets.push({
        label: 'Inflow',
        data: (monthlyData || []).map(d => explodedBars[`${d.month}_inflow`] ? 0 : d.inflow),
        backgroundColor: '#10b981',
        borderRadius: 4,
        stack: 'inflow'
    })

    datasets.push({
        label: 'Outflow',
        data: (monthlyData || []).map(d => explodedBars[`${d.month}_outflow`] ? 0 : d.outflow),
        backgroundColor: '#ef4444',
        borderRadius: 4,
        stack: 'outflow'
    })

    sortedCategories.forEach((catName, idx) => {
        const color = categoryColors[idx % categoryColors.length]
        datasets.push({
            label: `${catName} (In)`,
            data: (monthlyData || []).map(d => {
                const exploded = explodedBars[`${d.month}_inflow`]
                if (!exploded) return 0
                const cat = exploded.find(c => c.category === catName)
                return cat ? cat.total : 0
            }),
            backgroundColor: color,
            stack: 'inflow',
            hidden: false
        })
    })

    sortedCategories.forEach((catName, idx) => {
        const color = categoryColors[idx % categoryColors.length]
        datasets.push({
            label: `${catName} (Out)`,
            data: (monthlyData || []).map(d => {
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
        labels: (monthlyData || []).map(d => d.month),
        datasets: datasets
    }

    const handleSelectBar = (event, elements) => {
        if (elements.length > 0) {
            const index = elements[0].index
            const datasetIndex = elements[0].datasetIndex
            const month = monthlyData[index].month
            const dataset = datasets[datasetIndex]
            
            const isOutflow = dataset.stack === 'outflow'
            
            if (dataset.label.includes('(')) {
                const categoryName = dataset.label.split(' (')[0]
                const catId = allCategories.find(c => c.name === categoryName)?.id
                setSelectedCategory({ category: categoryName, category_id: catId, isMonthlyTotal: true })
            } else {
                setSelectedCategory({ category: `Total ${isOutflow ? 'Outflow' : 'Inflow'}`, type: isOutflow ? 'outflow' : 'inflow', isMonthlyTotal: true })
            }
            
            const start = `${month}-01`
            const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]
            
            setCustomStart(start)
            setCustomEnd(end)
            setPeriod('custom')
            
            setTimeout(() => {
                document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
        }
    }

    const handleRightClick = async (event, elements) => {
        event.preventDefault()
        if (elements.length > 0) {
            const index = elements[0].index
            const datasetIndex = elements[0].datasetIndex
            const month = monthlyData[index].month
            const stack = datasets[datasetIndex].stack
            const key = `${month}_${stack}`

            if (explodedBars[key]) {
                const newExploded = { ...explodedBars }
                delete newExploded[key]
                setExplodedBars(newExploded)
            } else {
                try {
                    const start = `${month}-01`
                    const end = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]
                    const res = await axios.get('/api/analytics/summary', { params: { start_date: start, end_date: end } })
                    
                    const cats = stack === 'inflow' ? res.data.income_categories : res.data.spending_categories
                    setExplodedBars({ ...explodedBars, [key]: cats })
                } catch (err) {
                    console.error("Failed to explode bar", err)
                }
            }
        }
    }

    const barOptions = {
        maintainAspectRatio: false,
        onClick: handleSelectBar,
        plugins: {
            legend: { display: false },
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
            },
            datalabels: { display: false }
        },
        scales: {
            x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: 'var(--text-muted)' } },
            y: { stacked: false, border: { display: false }, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: 'var(--text-muted)', callback: (val) => `$${val}` } }
        }
    }

    const getHierarchicalCategories = () => {
        const getPath = (catId) => {
            const cat = allCategories.find(c => c.id === catId)
            if (!cat) return ''
            if (!cat.parent_id) return cat.name
            return `${getPath(cat.parent_id)} / ${cat.name}`
        }
        return allCategories.map(c => ({ ...c, fullPath: getPath(c.id), level: (getPath(c.id).match(/\//g) || []).length })).sort((a, b) => a.fullPath.localeCompare(b.fullPath))
    }

    const hierarchicalCategories = getHierarchicalCategories()

    const onChartClick = (event) => {
        const element = getElementAtEvent(chartRef.current, event)
        if (element.length > 0) {
            const index = element[0].index
            const clicked = processedSpending[index]
            const hasChildren = allCategories.some(c => c.parent_id === clicked.id)
            
            if (clicked.id && hasChildren) {
                setDrilledCategoryId(clicked.id)
            } else {
                setSelectedCategory(clicked)
                setTimeout(() => {
                    document.getElementById('details-section')?.scrollIntoView({ behavior: 'smooth' })
                }, 100)
            }
        }
    }

    return (
        <div className="dashboard-page">
            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1>Analytics Overview</h1>
                    <p className="text-muted">Tracking your financial health and spending patterns.</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="glass-card" style={{ padding: '0.75rem 1.5rem', textAlign: 'center', borderLeft: '4px solid var(--danger)' }}>
                        <div className="text-muted small">Total Spending</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>
                            ${totalSpending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="glass-card" style={{ padding: '0.75rem 1.5rem', textAlign: 'center', borderLeft: '4px solid var(--success)' }}>
                        <div className="text-muted small">Total Income</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                            ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </header>

            <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem', alignSelf: 'flex-end', maxWidth: 'fit-content', marginLeft: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                    <Calendar size={18} />
                    <span className="small" style={{ fontWeight: 600 }}>Period:</span>
                </div>

                <select value={period} onChange={(e) => setPeriod(e.target.value)} className="form-control-minimal">
                    <option value="all">All Time</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="custom">Custom Range</option>
                </select>

                {period === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem', paddingLeft: '0.5rem', borderLeft: '1px solid var(--border)' }}>
                        <input type="date" className="date-input" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                        <span className="text-muted">to</span>
                        <input type="date" className="date-input" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                    </div>
                )}
            </div>

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
            ) : summary.spending_categories?.length === 0 && totalIncome === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <h2 style={{ color: 'var(--text-muted)' }}>No data for this period</h2>
                    <p style={{ marginTop: '1rem' }}>Adjust your filter or upload more transactions.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: accountSpending.length > 0 ? '1fr 1fr' : '1fr', gap: '2rem' }}>
                    <div className="glass-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <h2 style={{ margin: 0 }}>Spending by Category</h2>
                                <div className="badge-hint" style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                    Right-click to split slice
                                </div>
                                {drillPath.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                                        <ChevronDown size={14} style={{ transform: 'rotate(-90deg)', opacity: 0.5 }} />
                                        <button onClick={() => setDrilledCategoryId(null)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}>All</button>
                                        {drillPath.map((cat, i) => (
                                            <React.Fragment key={cat.id}>
                                                <ChevronDown size={14} style={{ transform: 'rotate(-90deg)', opacity: 0.5 }} />
                                                <button onClick={() => setDrilledCategoryId(cat.id)} style={{ background: 'none', border: 'none', color: i === drillPath.length - 1 ? 'white' : 'var(--primary)', cursor: i === drillPath.length - 1 ? 'default' : 'pointer', padding: 0, fontWeight: i === drillPath.length - 1 ? 700 : 400 }} disabled={i === drillPath.length - 1}>
                                                    {cat.name}
                                                </button>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                <Filter size={14} /> 
                                {selectedCategory ? selectedCategory.name || selectedCategory.category : 'All Categories'}
                                {selectedCategory && (
                                    <button onClick={() => setSelectedCategory(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
                            <Pie
                                ref={chartRef}
                                data={pieData}
                                onClick={onChartClick}
                                onContextMenu={handlePieRightClick}
                                plugins={[ChartDataLabels]}
                                options={{
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'right', labels: { color: 'white', padding: 20 } },
                                        datalabels: {
                                            color: '#fff',
                                            formatter: (value, ctx) => {
                                                const total = ctx.chart.data.datasets[0].data.reduce((acc, curr) => acc + curr, 0);
                                                const percentage = ((value / total) * 100).toFixed(1) + '%';
                                                const label = ctx.chart.data.labels[ctx.dataIndex];
                                                return (value / total) > 0.04 ? `${label}\n$${Math.round(value)}` : '';
                                            },
                                            font: { weight: 'bold', size: 10 },
                                            textAlign: 'center',
                                            display: 'auto'
                                        },
                                        tooltip: {
                                            callbacks: {
                                                label: (context) => {
                                                    const value = context.raw;
                                                    const total = context.chart.data.datasets[context.datasetIndex].data.reduce((acc, curr) => acc + curr, 0);
                                                    const percentage = ((value / total) * 100).toFixed(1) + '%';
                                                    return ` ${context.label}: $${value.toFixed(2)} (${percentage})`;
                                                }
                                            }
                                        }
                                    },
                                    onHover: (event, chartElement) => {
                                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {accountSpending.length > 0 && (() => {
                        const accountPalette = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#3b82f6', '#14b8a6']
                        const accountPieData = {
                            labels: accountSpending.map(a => a.account),
                            datasets: [{
                                data: accountSpending.map(a => a.total),
                                backgroundColor: accountSpending.map((_, i) => accountPalette[i % accountPalette.length]),
                                borderWidth: 0,
                            }]
                        }
                        return (
                            <div className="glass-card">
                                <div style={{ marginBottom: '2rem' }}>
                                    <h2 style={{ margin: 0 }}>Spending by Account</h2>
                                </div>
                                <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
                                    <Pie
                                        ref={accountChartRef}
                                        data={accountPieData}
                                        plugins={[ChartDataLabels]}
                                        options={{
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: { position: 'right', labels: { color: 'white', padding: 20 } },
                                                datalabels: {
                                                    color: '#fff',
                                                    formatter: (value, ctx) => {
                                                        const total = ctx.chart.data.datasets[0].data.reduce((acc, curr) => acc + curr, 0)
                                                        return (value / total) > 0.04 ? `${ctx.chart.data.labels[ctx.dataIndex]}\n$${Math.round(value)}` : ''
                                                    },
                                                    font: { weight: 'bold', size: 10 },
                                                    textAlign: 'center',
                                                    display: 'auto'
                                                },
                                                tooltip: {
                                                    callbacks: {
                                                        label: (context) => {
                                                            const value = context.raw
                                                            const total = context.chart.data.datasets[context.datasetIndex].data.reduce((acc, curr) => acc + curr, 0)
                                                            const pct = ((value / total) * 100).toFixed(1)
                                                            return ` ${context.label}: $${value.toFixed(2)} (${pct}%)`
                                                        }
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })()}
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
                                {selectedCategory ? selectedCategory.category || selectedCategory.name : 'All Transactions'}
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
                                                        <span style={{ padding: '0.1rem 0.4rem', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary-light)', borderRadius: '10px', fontSize: '0.65rem', border: '1px solid var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>Transfer</span>
                                                        {t.to_account && <span style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>↳ {t.to_account.name}</span>}
                                                    </div>
                                                )}
                                                <select value={t.category_id || ''} onChange={(e) => handleUpdateCategory(t.id, e.target.value ? parseInt(e.target.value) : null)} style={{ background: t.is_transfer ? 'transparent' : 'rgba(99, 102, 241, 0.1)', border: t.is_transfer ? '1px solid rgba(255,255,255,0.05)' : 'none', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: t.is_transfer ? 'var(--text-muted)' : 'var(--primary)', fontWeight: 500, fontSize: '0.875rem', outline: 'none', cursor: 'pointer', width: '100%', maxWidth: '180px' }}>
                                                    <option value="">Uncategorized</option>
                                                    {hierarchicalCategories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{'\u00A0'.repeat(cat.level * 3)}{cat.level > 0 ? '↳ ' : ''}{cat.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>{t.description}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right', color: t.amount < 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>${t.amount.toFixed(2)}</td>
                                        <td style={{ textAlign: 'right', padding: '1rem' }}>
                                            <button onClick={() => handleDelete(t.id)} className="btn-icon" style={{ color: 'var(--text-muted)', opacity: 0.5 }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .badge-hint { padding: 0.2rem 0.6rem; border-radius: 1rem; background: rgba(255, 255, 255, 0.05); color: var(--text-muted); font-size: 0.75rem; border: 1px solid var(--border); transition: all 0.2s; }
                .badge-hint.active { background: rgba(99, 102, 241, 0.2); color: var(--primary-light); border-color: var(--primary); }
                .spinner { width: 40px; height: 40px; border: 3px solid rgba(99, 102, 241, 0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}} />
        </div>
    )
}

export default Dashboard
