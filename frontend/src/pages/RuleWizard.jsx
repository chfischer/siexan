import React, { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import { Wand2, CheckSquare, Square, ChevronRight, ChevronDown, Plus, X } from 'lucide-react'

function RuleWizard({ refreshTrigger }) {
    const [suggestions, setSuggestions] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [assignments, setAssignments] = useState({}) // merchant_key -> category_id
    const [selected, setSelected] = useState(new Set()) // merchant_keys
    const [showCovered, setShowCovered] = useState(false)
    const [accountFilter, setAccountFilter] = useState('all')
    const [notification, setNotification] = useState(null)
    const [focusedIndex, setFocusedIndex] = useState(0)
    const [expanded, setExpanded] = useState(new Set()) // rowKeys
    const [txnCache, setTxnCache] = useState({}) // rowKey -> txns[]
    const [newCatFor, setNewCatFor] = useState(null) // merchant_key
    const [newCatName, setNewCatName] = useState('')
    const [newCatSaving, setNewCatSaving] = useState(false)
    const newCatInputRef = useRef(null)

    const containerRef = useRef(null)
    const selectRefs = useRef([])
    const rowRefs = useRef([])
    const keyHandlerRef = useRef(null)

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true)
            try {
                const [sugRes, catRes] = await Promise.all([
                    axios.get('/api/rules/suggest'),
                    axios.get('/api/categories/'),
                ])
                setSuggestions(sugRes.data)
                setCategories(catRes.data)
            } catch (err) {
                console.error('Error loading wizard data', err)
            } finally {
                setLoading(false)
            }
        }
        fetchAll()
    }, [refreshTrigger])

    const accounts = useMemo(() => {
        const names = [...new Set(suggestions.map(s => s.account_name))]
        return names.sort()
    }, [suggestions])

    const visible = useMemo(() => {
        return suggestions.filter(s => {
            if (!showCovered && s.has_rule) return false
            if (accountFilter !== 'all' && s.account_name !== accountFilter) return false
            return true
        })
    }, [suggestions, showCovered, accountFilter])

    // Keep focusedIndex in bounds when visible list shrinks
    useEffect(() => {
        if (visible.length > 0 && focusedIndex >= visible.length) {
            setFocusedIndex(visible.length - 1)
        }
    }, [visible.length])

    // Scroll focused row into view
    useEffect(() => {
        if (focusedIndex >= 0 && rowRefs.current[focusedIndex]) {
            rowRefs.current[focusedIndex].scrollIntoView({ block: 'nearest' })
        }
    }, [focusedIndex])

    const getHierarchicalCategories = () => {
        const getPath = (catId) => {
            const cat = categories.find(c => c.id === catId)
            if (!cat) return ''
            if (!cat.parent_id) return cat.name
            return `${getPath(cat.parent_id)} / ${cat.name}`
        }
        return categories
            .map(c => ({ ...c, fullPath: getPath(c.id), level: (getPath(c.id).match(/\//g) || []).length }))
            .sort((a, b) => a.fullPath.localeCompare(b.fullPath))
    }
    const hierarchicalCategories = getHierarchicalCategories()

    const rowKey = (s) => `${s.merchant_key}__${s.account_id}`

    const toggleExpand = async (s) => {
        const key = rowKey(s)
        const next = new Set(expanded)
        if (next.has(key)) {
            next.delete(key)
            setExpanded(next)
        } else {
            next.add(key)
            setExpanded(next)
            if (!txnCache[key]) {
                try {
                    const res = await axios.get('/api/rules/suggest/transactions', {
                        params: { merchant_key: s.merchant_key, account_id: s.account_id }
                    })
                    setTxnCache(prev => ({ ...prev, [key]: res.data }))
                } catch (err) {
                    console.error('Error loading transactions', err)
                    setTxnCache(prev => ({ ...prev, [key]: [] }))
                }
            }
        }
    }

    const openNewCat = (merchantKey) => {
        setNewCatFor(merchantKey)
        setNewCatName('')
        setTimeout(() => newCatInputRef.current?.focus(), 30)
    }

    const closeNewCat = () => {
        setNewCatFor(null)
        setNewCatName('')
    }

    const handleCreateCategory = async (merchantKey) => {
        const name = newCatName.trim()
        if (!name) return
        setNewCatSaving(true)
        try {
            const res = await axios.post('/api/categories/', { name, is_income: false })
            const newCat = res.data
            // Refresh categories
            const catRes = await axios.get('/api/categories/')
            setCategories(catRes.data)
            // Auto-assign this category to the row
            setAssignments(prev => ({ ...prev, [merchantKey]: String(newCat.id) }))
            setSelected(prev => new Set([...prev, merchantKey]))
            closeNewCat()
        } catch (err) {
            console.error('Error creating category', err)
        } finally {
            setNewCatSaving(false)
        }
    }

    const toggleSelect = (key) => {
        const next = new Set(selected)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        setSelected(next)
    }

    const selectAll = () => {
        const eligible = visible.filter(s => assignments[s.merchant_key])
        setSelected(new Set(eligible.map(s => s.merchant_key)))
    }

    const deselectAll = () => setSelected(new Set())

    const selectedCount = [...selected].filter(k => assignments[k]).length

    const handleCreateRules = async () => {
        const toCreate = [...selected].filter(k => assignments[k])
        if (toCreate.length === 0) return

        setSaving(true)
        let created = 0
        try {
            for (const key of toCreate) {
                await axios.post('/api/rules/', {
                    pattern: key,
                    target_category_id: parseInt(assignments[key]),
                    priority: 0,
                })
                created++
            }
            setNotification({ type: 'success', message: `Created ${created} rule${created !== 1 ? 's' : ''}` })
            const res = await axios.get('/api/rules/suggest')
            setSuggestions(res.data)
            setSelected(new Set())
        } catch (err) {
            console.error('Error creating rules', err)
            setNotification({ type: 'error', message: 'Failed to create some rules' })
        } finally {
            setSaving(false)
            setTimeout(() => setNotification(null), 3000)
        }
    }

    // Always-current handler stored in a ref to avoid stale closures
    keyHandlerRef.current = (e) => {
        const tag = document.activeElement?.tagName
        if (tag === 'SELECT') {
            if (e.key === 'Escape') {
                e.preventDefault()
                containerRef.current?.focus()
            } else if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault()
                const idx = selectRefs.current.indexOf(document.activeElement)
                const nextIdx = idx >= 0 && idx + 1 < visible.length ? idx + 1 : idx
                setFocusedIndex(nextIdx)
                containerRef.current?.focus()
            } else if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault()
                containerRef.current?.focus()
            }
            return
        }
        if (tag === 'INPUT' || tag === 'TEXTAREA') return

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setFocusedIndex(i => Math.min(i + 1, visible.length - 1))
                break
            case 'ArrowUp':
                e.preventDefault()
                setFocusedIndex(i => Math.max(i - 1, 0))
                break
            case 'ArrowRight':
                if (focusedIndex >= 0) {
                    e.preventDefault()
                    toggleExpand(visible[focusedIndex])
                }
                break
            case 'ArrowLeft':
                if (focusedIndex >= 0) {
                    e.preventDefault()
                    const s = visible[focusedIndex]
                    const key = rowKey(s)
                    if (expanded.has(key)) {
                        setExpanded(prev => { const n = new Set(prev); n.delete(key); return n })
                    }
                }
                break
            case ' ':
                if (focusedIndex >= 0) {
                    const s = visible[focusedIndex]
                    if (s && !s.has_rule && assignments[s.merchant_key]) {
                        e.preventDefault()
                        toggleSelect(s.merchant_key)
                    }
                }
                break
            case 'Enter':
                if (selectedCount > 0 && !saving) {
                    e.preventDefault()
                    handleCreateRules()
                }
                break
            case 'Tab':
                if (!e.shiftKey && focusedIndex >= 0) {
                    const s = visible[focusedIndex]
                    if (s && !s.has_rule) {
                        e.preventDefault()
                        selectRefs.current[focusedIndex]?.focus()
                    }
                }
                break
            case 'n':
                if (focusedIndex >= 0) {
                    const s = visible[focusedIndex]
                    if (s && !s.has_rule) {
                        e.preventDefault()
                        openNewCat(s.merchant_key)
                    }
                }
                break
            case 'Escape':
                if (newCatFor) {
                    e.preventDefault()
                    closeNewCat()
                }
                break
        }
    }

    useEffect(() => {
        const handler = (e) => keyHandlerRef.current(e)
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const handleSelectChange = (e, merchantKey, idx) => {
        const val = e.target.value
        setAssignments(prev => ({ ...prev, [merchantKey]: val }))
        if (val) {
            setSelected(prev => new Set([...prev, merchantKey]))
            // Auto-advance to next row
            const nextIdx = idx + 1
            if (nextIdx < visible.length) {
                setFocusedIndex(nextIdx)
            }
            containerRef.current?.focus()
        } else {
            setSelected(prev => { const n = new Set(prev); n.delete(merchantKey); return n })
        }
    }

    return (
        <div className="dashboard-page">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <Wand2 size={22} style={{ color: 'var(--primary)' }} />
                        <h1 style={{ margin: 0 }}>Rule Wizard</h1>
                    </div>
                    <p className="text-muted">Assign categories to merchants in bulk to auto-generate rules.</p>
                </div>

                <button
                    className="btn-primary"
                    disabled={selectedCount === 0 || saving}
                    onClick={handleCreateRules}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Wand2 size={16} />
                    {saving ? 'Creating…' : `Create ${selectedCount} Rule${selectedCount !== 1 ? 's' : ''}`}
                </button>
            </header>

            {notification && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    background: notification.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${notification.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
                    color: notification.type === 'success' ? 'var(--success)' : 'var(--danger)',
                    fontSize: '0.875rem',
                }}>
                    {notification.message}
                </div>
            )}

            <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="text-muted small">Account:</span>
                    <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} className="form-control-minimal">
                        <option value="all">All</option>
                        {accounts.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    <input type="checkbox" checked={showCovered} onChange={e => setShowCovered(e.target.checked)} />
                    Show already covered
                </label>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', fontSize: '0.8rem' }}>
                    <button onClick={selectAll} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}>Select all with category</button>
                    <span style={{ color: 'var(--border)' }}>|</span>
                    <button onClick={deselectAll} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>Deselect all</button>
                </div>
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <div className="spinner" />
                    </div>
                ) : visible.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                        No suggestions. All merchants are already covered by rules.
                    </div>
                ) : (
                    <>
                        <div ref={containerRef} style={{ outline: 'none' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem 1rem', width: '2rem' }}></th>
                                        <th style={{ padding: '0.75rem 0.5rem', width: '1.5rem' }}></th>
                                        <th style={{ padding: '0.75rem 1rem' }}>Merchant</th>
                                        <th style={{ padding: '0.75rem 1rem' }}>Account</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Txns</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Spent</th>
                                        <th style={{ padding: '0.75rem 1rem', minWidth: '220px' }}>Category</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((s, idx) => {
                                        const isSelected = selected.has(s.merchant_key)
                                        const hasCategory = !!assignments[s.merchant_key]
                                        const isFocused = idx === focusedIndex
                                        const key = rowKey(s)
                                        const isExpanded = expanded.has(key)
                                        const txns = txnCache[key]
                                        return (
                                            <React.Fragment key={key}>
                                                <tr
                                                    ref={el => rowRefs.current[idx] = el}
                                                    style={{
                                                        borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                                                        opacity: s.has_rule ? 0.5 : 1,
                                                        background: isSelected
                                                            ? 'rgba(99,102,241,0.08)'
                                                            : isFocused
                                                            ? 'rgba(99,102,241,0.04)'
                                                            : 'transparent',
                                                        cursor: 'pointer',
                                                        outline: isFocused ? '2px solid rgba(99,102,241,0.4)' : 'none',
                                                        outlineOffset: '-2px',
                                                    }}
                                                    onClick={() => {
                                                        setFocusedIndex(idx)
                                                        containerRef.current?.focus()
                                                        if (!s.has_rule && hasCategory) toggleSelect(s.merchant_key)
                                                    }}
                                                >
                                                    <td style={{ padding: '0.75rem 1rem' }}>
                                                        {s.has_rule ? (
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: '4px', padding: '0.1rem 0.3rem' }}>✓</span>
                                                        ) : (
                                                            <span style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)', opacity: hasCategory ? 1 : 0.3 }}>
                                                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.25rem' }} onClick={e => { e.stopPropagation(); toggleExpand(s) }}>
                                                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{s.merchant_key}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.account_name}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>{s.count}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--danger)' }}>
                                                        ${s.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem' }} onClick={e => e.stopPropagation()}>
                                                        {s.has_rule ? (
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Already covered</span>
                                                        ) : newCatFor === s.merchant_key ? (
                                                            <form
                                                                onSubmit={e => { e.preventDefault(); handleCreateCategory(s.merchant_key) }}
                                                                style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}
                                                            >
                                                                <input
                                                                    ref={newCatInputRef}
                                                                    value={newCatName}
                                                                    onChange={e => setNewCatName(e.target.value)}
                                                                    placeholder="Name or Parent/Child"
                                                                    style={{ flex: 1, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.4)', padding: '0.3rem 0.5rem', borderRadius: '0.375rem', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', minWidth: 0 }}
                                                                    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); closeNewCat() } else e.stopPropagation() }}
                                                                />
                                                                <button type="submit" disabled={!newCatName.trim() || newCatSaving} style={{ background: 'var(--primary)', border: 'none', borderRadius: '0.375rem', padding: '0.3rem 0.6rem', color: '#fff', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                                    {newCatSaving ? '…' : 'Create'}
                                                                </button>
                                                                <button type="button" onClick={closeNewCat} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}>
                                                                    <X size={14} />
                                                                </button>
                                                            </form>
                                                        ) : (
                                                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                                <select
                                                                    ref={el => selectRefs.current[idx] = el}
                                                                    value={assignments[s.merchant_key] || ''}
                                                                    onChange={e => handleSelectChange(e, s.merchant_key, idx)}
                                                                    style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: '0.3rem 0.5rem', borderRadius: '0.375rem', color: assignments[s.merchant_key] ? 'var(--primary-light)' : 'var(--text-muted)', fontSize: '0.875rem', outline: 'none', flex: 1, minWidth: 0 }}
                                                                >
                                                                    <option value="">— assign category —</option>
                                                                    {hierarchicalCategories.map(cat => (
                                                                        <option key={cat.id} value={cat.id}>
                                                                            {'\u00A0'.repeat(cat.level * 3)}{cat.level > 0 ? '↳ ' : ''}{cat.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    title="New category (n)"
                                                                    onClick={() => openNewCat(s.merchant_key)}
                                                                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem 0.35rem', display: 'flex', flexShrink: 0 }}
                                                                >
                                                                    <Plus size={13} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td colSpan={7} style={{ padding: 0, background: 'rgba(0,0,0,0.15)' }}>
                                                            {!txns ? (
                                                                <div style={{ padding: '0.75rem 3rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading…</div>
                                                            ) : txns.length === 0 ? (
                                                                <div style={{ padding: '0.75rem 3rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No transactions found.</div>
                                                            ) : (
                                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                                    <tbody>
                                                                        {txns.map(t => (
                                                                            <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                                                <td style={{ padding: '0.4rem 3rem', color: 'var(--text-muted)', width: '8rem' }}>{t.date}</td>
                                                                                <td style={{ padding: '0.4rem 1rem', color: 'var(--text-secondary)' }}>{t.description}</td>
                                                                                <td style={{ padding: '0.4rem 1rem', textAlign: 'right', color: 'var(--danger)', width: '8rem', fontVariantNumeric: 'tabular-nums' }}>
                                                                                    ${Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                            <span><kbd>↑↓</kbd> navigate</span>
                            <span><kbd>→</kbd> expand</span>
                            <span><kbd>←</kbd> collapse</span>
                            <span><kbd>Tab</kbd> edit category</span>
                            <span><kbd>n</kbd> new category</span>
                            <span><kbd>Space</kbd> toggle selection</span>
                            <span><kbd>Enter</kbd> create rules</span>
                            <span><kbd>Esc</kbd> back to list</span>
                        </div>
                    </>
                )}
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .spinner { width: 36px; height: 36px; border: 3px solid rgba(99,102,241,0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                kbd { display: inline-block; padding: 0.1rem 0.35rem; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 3px; font-family: inherit; font-size: 0.7rem; line-height: 1.4; }
            `}} />
        </div>
    )
}

export default RuleWizard
