import React, { useState, useEffect, useMemo, useContext, createContext } from 'react'
import axios from 'axios'
import {
    Tag, ChevronRight, ChevronDown, Plus, Edit3, Trash2,
    Search, Check, X, Lock, FolderPlus, AlertCircle,
    Layers, GripVertical, Hash, PlusCircle, Download, FileUp
} from 'lucide-react'
import EditRuleModal from '../components/EditRuleModal'
import Notification from '../components/Notification'

const TreeCtx = createContext(null)

function DropLine() {
    return (
        <div style={{
            height: '2px', borderRadius: '1px',
            background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)',
            margin: '1px 0.25rem',
        }} />
    )
}

function RuleChip({ rule }) {
    const { handleDeleteRule, setEditingRule } = useContext(TreeCtx)
    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(99,102,241,0.06)', padding: '0.3rem 0.6rem', borderRadius: '0.4rem', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.8rem' }}>
            <Hash size={10} style={{ color: 'var(--text-muted)' }} />
            <code style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>{rule.pattern}</code>
            {rule.amount_condition && (
                <span style={{ fontSize: '0.72rem', color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '0.05rem 0.35rem', borderRadius: '0.3rem', fontFamily: 'monospace' }}>
                    {rule.amount_condition}
                </span>
            )}
            <button onClick={() => setEditingRule(rule)} style={{ background: 'none', border: 'none', padding: '1px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            ><Edit3 size={11} /></button>
            <button onClick={() => handleDeleteRule(rule.id)} style={{ background: 'none', border: 'none', padding: '1px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            ><Trash2 size={11} /></button>
        </div>
    )
}

// Defined at module level to prevent React remounting during drag state changes
function CategoryNode({ node, level = 0 }) {
    const {
        rules, categories, draggedId, setDraggedId, dropTarget, setDropTarget,
        panel, isSystemCategory, isExpanded, toggleExpand,
        openAdd, openEdit, handleDelete, onDragStart, onDrop,
        rulesExpandedIds, toggleRulesExpand,
        addingRuleTo, setAddingRuleTo, newRulePattern, setNewRulePattern,
        newAmountCondition, setNewAmountCondition, handleCreateRule,
    } = useContext(TreeCtx)

    const nodeRules = rules.filter(r => r.target_category_id === node.id)
    const isSystem = isSystemCategory(node)
    const isActive = panel?.mode === 'edit' && panel.cat.id === node.id
    const isDragging = draggedId === node.id
    const isDropBefore = dropTarget?.id === node.id && dropTarget.position === 'before'
    const isDropAfter = dropTarget?.id === node.id && dropTarget.position === 'after'
    const expanded = isExpanded(node.id)
    const rulesExpanded = rulesExpandedIds.has(node.id)
    const isAddingRule = addingRuleTo === node.id

    const handleDragOver = (e) => {
        e.preventDefault()
        if (isSystem || draggedId === node.id) return
        const dragged = categories.find(c => c.id === draggedId)
        if (!dragged || dragged.parent_id !== node.parent_id) return
        e.dataTransfer.dropEffect = 'move'
        const rect = e.currentTarget.getBoundingClientRect()
        const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
        setDropTarget({ id: node.id, position })
    }

    return (
        <div style={{ marginLeft: level > 0 ? '1.5rem' : 0 }}>
            {isDropBefore && <DropLine />}

            <div
                className="cat-row"
                draggable={!isSystem}
                onDragStart={e => !isSystem && onDragStart(e, node.id)}
                onDragOver={handleDragOver}
                onDragLeave={e => {
                    if (!e.currentTarget.contains(e.relatedTarget))
                        setDropTarget(p => p?.id === node.id ? null : p)
                }}
                onDrop={e => onDrop(e, node.id)}
                onDragEnd={() => { setDraggedId(null); setDropTarget(null) }}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.55rem 0.75rem', marginBottom: '0.25rem',
                    borderRadius: '0.6rem',
                    background: isActive ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
                    transition: 'background 0.15s, border-color 0.15s',
                    opacity: isSystem ? 0.65 : isDragging ? 0.35 : 1,
                    cursor: isSystem ? 'default' : 'grab',
                }}
            >
                {!isSystem && (
                    <GripVertical size={14} style={{ color: 'var(--text-muted)', opacity: 0.4, flexShrink: 0 }} />
                )}

                <button
                    onClick={() => node.children.length > 0 && toggleExpand(node.id)}
                    style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        cursor: node.children.length > 0 ? 'pointer' : 'default',
                        padding: 0, display: 'flex', alignItems: 'center',
                        visibility: node.children.length > 0 ? 'visible' : 'hidden',
                        width: '16px', flexShrink: 0
                    }}
                >
                    {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>

                {isSystem
                    ? <Lock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    : <Tag size={13} style={{ color: node.is_income ? 'var(--success)' : 'var(--primary)', opacity: 0.75, flexShrink: 0 }} />
                }

                <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: level === 0 ? 600 : 400, color: 'var(--text-main)' }}>
                    {node.name}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {!isSystem && (
                        <span style={{
                            fontSize: '0.62rem', padding: '0.1rem 0.45rem', borderRadius: '1rem',
                            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                            background: node.is_income ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                            color: node.is_income ? 'var(--success)' : '#f87171',
                            border: `1px solid ${node.is_income ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`
                        }}>
                            {node.is_income ? 'income' : 'expense'}
                        </span>
                    )}
                    {/* Clickable rules badge */}
                    {!isSystem && (
                        <span
                            onClick={() => toggleRulesExpand(node.id)}
                            title="Show/hide rules"
                            style={{
                                fontSize: '0.7rem', cursor: 'pointer',
                                background: rulesExpanded ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                                color: rulesExpanded ? 'var(--primary-light)' : nodeRules.length > 0 ? 'var(--text-muted)' : 'rgba(255,255,255,0.2)',
                                padding: '0.1rem 0.4rem', borderRadius: '1rem',
                                border: `1px solid ${rulesExpanded ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                                transition: 'all 0.15s', userSelect: 'none',
                            }}
                        >
                            {nodeRules.length} rule{nodeRules.length !== 1 ? 's' : ''}
                        </span>
                    )}
                    {node.children.length > 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.5 }}>
                            {node.children.length} sub
                        </span>
                    )}
                </div>

                {!isSystem && (
                    <div className="cat-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexShrink: 0 }}>
                        <button
                            onClick={() => { toggleRulesExpand(node.id, true); setAddingRuleTo(node.id); setNewRulePattern(''); setNewAmountCondition('') }}
                            title="Add rule"
                            className="cat-action-btn"
                        >
                            <Hash size={12} />
                        </button>
                        <button onClick={() => openAdd(node.id)} title="Add subcategory" className="cat-action-btn">
                            <FolderPlus size={12} />
                        </button>
                        <button onClick={() => openEdit(node)} title="Edit" className="cat-action-btn">
                            <Edit3 size={12} />
                        </button>
                        <button onClick={() => handleDelete(node)} title="Delete" className="cat-action-btn cat-action-danger">
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
            </div>

            {isDropAfter && <DropLine />}

            {/* Inline rules section */}
            {rulesExpanded && !isSystem && (
                <div style={{
                    marginLeft: level > 0 ? '1rem' : '2rem',
                    marginBottom: '0.4rem',
                    padding: '0.6rem 0.75rem',
                    background: 'rgba(99,102,241,0.04)',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(99,102,241,0.15)',
                }}>
                    {nodeRules.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: isAddingRule ? '0.6rem' : 0 }}>
                            {nodeRules.map(rule => <RuleChip key={rule.id} rule={rule} />)}
                        </div>
                    )}

                    {isAddingRule ? (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: nodeRules.length > 0 ? '0.5rem' : 0, flexWrap: 'wrap' }}>
                            <input
                                autoFocus
                                type="text"
                                className="form-control"
                                placeholder="e.g. UBER.* or STARBUCKS"
                                style={{ flex: 2, minWidth: '140px', fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                                value={newRulePattern}
                                onChange={e => setNewRulePattern(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleCreateRule(node.id, 'category')
                                    if (e.key === 'Escape') setAddingRuleTo(null)
                                }}
                            />
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. >100"
                                title="Amount condition (optional)"
                                style={{ width: '90px', fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                                value={newAmountCondition}
                                onChange={e => setNewAmountCondition(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleCreateRule(node.id, 'category')
                                    if (e.key === 'Escape') setAddingRuleTo(null)
                                }}
                            />
                            <button onClick={() => handleCreateRule(node.id, 'category')} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>Add</button>
                            <button onClick={() => setAddingRuleTo(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '0.4rem 0.65rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                                <X size={13} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => { setAddingRuleTo(node.id); setNewRulePattern(''); setNewAmountCondition('') }}
                            style={{
                                background: 'none', border: '1px dashed rgba(99,102,241,0.3)', color: 'var(--primary)',
                                padding: '0.25rem 0.6rem', borderRadius: '0.4rem', cursor: 'pointer',
                                fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                marginTop: nodeRules.length > 0 ? '0.5rem' : 0,
                                transition: 'border-color 0.15s, background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            <Plus size={12} /> Add rule
                        </button>
                    )}
                </div>
            )}

            {expanded && node.children.length > 0 && (
                <div style={{ marginBottom: '0.25rem' }}>
                    {node.children.map(child => <CategoryNode key={child.id} node={child} level={level + 1} />)}
                </div>
            )}
        </div>
    )
}

function CategoryManagement({ refreshTrigger }) {
    // Shared data
    const [categories, setCategories] = useState([])
    const [rules, setRules] = useState([])
    const [accounts, setAccounts] = useState([])
    const [labels, setLabels] = useState([])
    const [loading, setLoading] = useState(true)
    const [notification, setNotification] = useState(null)

    // Tree state
    const [expandedIds, setExpandedIds] = useState(new Set())
    const [rulesExpandedIds, setRulesExpandedIds] = useState(new Set())
    const [searchQuery, setSearchQuery] = useState('')
    const [draggedId, setDraggedId] = useState(null)
    const [dropTarget, setDropTarget] = useState(null)

    // Category edit panel
    const [panel, setPanel] = useState(null)
    const [formName, setFormName] = useState('')
    const [formParentId, setFormParentId] = useState('')
    const [formIsIncome, setFormIsIncome] = useState(false)
    const [formSaving, setFormSaving] = useState(false)
    const [formError, setFormError] = useState(null)

    // Rules state
    const [addingRuleTo, setAddingRuleTo] = useState(null)
    const [newRulePattern, setNewRulePattern] = useState('')
    const [newAmountCondition, setNewAmountCondition] = useState('')
    const [editingRule, setEditingRule] = useState(null)

    // Labels/transfers section visibility
    const [transfersOpen, setTransfersOpen] = useState(true)
    const [labelsOpen, setLabelsOpen] = useState(true)
    const [addingLabelRuleTo, setAddingLabelRuleTo] = useState(null)
    const [labelRulePattern, setLabelRulePattern] = useState('')
    const [addingTransferRuleTo, setAddingTransferRuleTo] = useState(null)
    const [transferRulePattern, setTransferRulePattern] = useState('')
    const [newLabelName, setNewLabelName] = useState('')
    const [newLabelColor, setNewLabelColor] = useState('#6366f1')
    const [addingLabel, setAddingLabel] = useState(false)

    useEffect(() => { fetchData() }, [refreshTrigger])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [catRes, ruleRes, accRes, labelRes] = await Promise.all([
                axios.get('/api/categories/'),
                axios.get('/api/rules/'),
                axios.get('/api/accounts/'),
                axios.get('/api/labels/'),
            ])
            setCategories(catRes.data)
            setRules(ruleRes.data)
            setAccounts(accRes.data)
            setLabels(labelRes.data)
        } catch {
            setNotification({ type: 'error', message: 'Failed to load data' })
        } finally {
            setLoading(false)
        }
    }

    // ── Category handlers ────────────────────────────────────────────────────

    const openAdd = (parentId = null) => {
        const parent = parentId ? categories.find(c => c.id === parentId) : null
        setPanel({ mode: 'add', parentId })
        setFormName('')
        setFormParentId(parentId != null ? String(parentId) : '')
        setFormIsIncome(parent ? !!parent.is_income : false)
        setFormError(null)
    }

    const openEdit = (cat) => {
        setPanel({ mode: 'edit', cat })
        setFormName(cat.name)
        setFormParentId(cat.parent_id != null ? String(cat.parent_id) : '')
        setFormIsIncome(!!cat.is_income)
        setFormError(null)
    }

    const closePanel = () => { setPanel(null); setFormError(null) }

    const handleSave = async () => {
        if (!formName.trim()) { setFormError('Name is required'); return }
        setFormSaving(true); setFormError(null)
        try {
            const payload = {
                name: formName.trim(),
                parent_id: formParentId ? parseInt(formParentId) : null,
                is_income: formIsIncome,
                priority: panel.mode === 'edit' ? panel.cat.priority : 0
            }
            if (panel.mode === 'edit') {
                await axios.put(`/api/categories/${panel.cat.id}`, payload)
                setNotification({ type: 'success', message: `"${payload.name}" updated` })
            } else {
                await axios.post('/api/categories/', payload)
                setNotification({ type: 'success', message: `"${payload.name}" created` })
                if (panel.parentId) setExpandedIds(prev => new Set([...prev, panel.parentId]))
            }
            closePanel(); fetchData()
        } catch (err) {
            setFormError(err.response?.data?.detail || 'Save failed. Check for duplicate names.')
        } finally {
            setFormSaving(false)
        }
    }

    const handleDelete = async (cat) => {
        if (!window.confirm(`Delete "${cat.name}"? Subcategories will be moved up.`)) return
        try {
            await axios.delete(`/api/categories/${cat.id}`)
            if (panel?.mode === 'edit' && panel.cat.id === cat.id) closePanel()
            fetchData()
            setNotification({ type: 'success', message: `"${cat.name}" deleted` })
        } catch {
            setNotification({ type: 'error', message: 'Delete failed' })
        }
    }

    const onDragStart = (e, id) => {
        setDraggedId(id)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(id))
    }

    const onDrop = async (e, targetId) => {
        e.preventDefault()
        const position = dropTarget?.position ?? 'after'
        const dragged = categories.find(c => c.id === draggedId)
        const target = categories.find(c => c.id === targetId)
        setDraggedId(null); setDropTarget(null)
        if (!dragged || !target || dragged.id === target.id) return
        if (dragged.parent_id !== target.parent_id) return

        const siblings = categories
            .filter(c => c.parent_id === dragged.parent_id)
            .sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : a.name.localeCompare(b.name))

        const withoutDragged = siblings.filter(s => s.id !== dragged.id)
        const targetIdx = withoutDragged.findIndex(s => s.id === target.id)
        const insertIdx = position === 'before' ? targetIdx : targetIdx + 1
        const reordered = [...withoutDragged.slice(0, insertIdx), dragged, ...withoutDragged.slice(insertIdx)]
        const updates = reordered.map((cat, i) => ({ cat, i })).filter(({ cat, i }) => cat.priority !== i)
        if (updates.length === 0) return
        try {
            await Promise.all(updates.map(({ cat, i }) => axios.patch(`/api/categories/${cat.id}`, { priority: i })))
            fetchData()
        } catch {
            setNotification({ type: 'error', message: 'Move failed' })
        }
    }

    const isSystemCategory = (cat) => !!cat.target_account_id

    // ── Rule handlers ────────────────────────────────────────────────────────

    const handleCreateRule = async (targetId, type = 'category') => {
        const pattern = type === 'category' ? newRulePattern
            : type === 'label' ? labelRulePattern
            : transferRulePattern
        if (!pattern.trim()) return
        const amountCond = type === 'category' ? newAmountCondition.trim() : ''
        try {
            const payload = {
                pattern,
                amount_condition: amountCond || null,
                target_category_id: type === 'category' ? targetId : null,
                target_account_id: type === 'account' ? targetId : null,
                target_label_id: type === 'label' ? targetId : null,
            }
            const res = await axios.post('/api/rules/', payload)
            if (type === 'category') { setNewRulePattern(''); setNewAmountCondition(''); setAddingRuleTo(null) }
            if (type === 'label') { setLabelRulePattern(''); setAddingLabelRuleTo(null) }
            if (type === 'account') { setTransferRulePattern(''); setAddingTransferRuleTo(null) }
            fetchData()
            setNotification({ type: 'success', message: `Rule created! ${res.data.changes} transactions updated.` })
        } catch {
            setNotification({ type: 'error', message: 'Failed to create rule' })
        }
    }

    const handleDeleteRule = async (id) => {
        try {
            await axios.delete(`/api/rules/${id}`)
            fetchData()
        } catch {
            setNotification({ type: 'error', message: 'Failed to delete rule' })
        }
    }

    const handleReCategorize = async () => {
        try {
            const res = await axios.post('/api/rules/re-categorize/')
            let msg = res.data.message
            let type = 'success'
            if (res.data.failed_rules?.length > 0) {
                msg += '\n\nWarning: Some rules were skipped due to invalid regex:\n' +
                    res.data.failed_rules.map(r => `• ${r.pattern}: ${r.error}`).join('\n')
                type = 'info'
            }
            setNotification({ type, message: msg })
            fetchData()
        } catch (err) {
            setNotification({ type: 'error', message: err.response?.data?.detail || 'Failed to re-apply rules' })
        }
    }

    const exportRules = async () => {
        try {
            const res = await axios.get('/api/rules/export/')
            const a = document.createElement('a')
            a.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2)))
            a.setAttribute('download', 'siexan_rules_backup.json')
            document.body.appendChild(a); a.click(); a.remove()
            setNotification({ type: 'success', message: 'Rules exported' })
        } catch {
            setNotification({ type: 'error', message: 'Failed to export rules' })
        }
    }

    const importRules = (e) => {
        const file = e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result)
                const res = await axios.post('/api/rules/import/', data)
                setNotification({ type: 'success', message: res.data.message })
                fetchData()
            } catch (err) {
                setNotification({ type: 'error', message: 'Import failed: ' + (err.response?.data?.detail || 'Invalid JSON') })
            }
        }
        reader.readAsText(file)
        e.target.value = null
    }

    const handleCreateLabel = async (e) => {
        e.preventDefault()
        if (!newLabelName.trim()) return
        try {
            await axios.post('/api/labels/', { name: newLabelName, color: newLabelColor })
            setNewLabelName(''); setAddingLabel(false)
            fetchData()
        } catch {
            setNotification({ type: 'error', message: 'Failed to create label' })
        }
    }

    // ── Tree helpers ─────────────────────────────────────────────────────────

    const categoryTree = useMemo(() => {
        const nodes = {}
        categories.forEach(c => nodes[c.id] = { ...c, children: [] })
        const roots = []
        categories.forEach(c => {
            if (c.parent_id && nodes[c.parent_id]) nodes[c.parent_id].children.push(nodes[c.id])
            else roots.push(nodes[c.id])
        })
        const sort = (list) => {
            list.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : a.name.localeCompare(b.name))
            list.forEach(n => sort(n.children))
        }
        sort(roots)
        return roots
    }, [categories])

    const { filteredTree, autoExpandedIds } = useMemo(() => {
        if (!searchQuery.trim()) return { filteredTree: categoryTree, autoExpandedIds: new Set() }
        const q = searchQuery.toLowerCase()
        const toExpand = new Set()
        const filter = (node) => {
            const match = node.name.toLowerCase().includes(q)
            const filteredChildren = node.children.map(filter).filter(Boolean)
            if (match || filteredChildren.length > 0) {
                if (filteredChildren.length > 0) toExpand.add(node.id)
                return { ...node, children: filteredChildren }
            }
            return null
        }
        return { filteredTree: categoryTree.map(filter).filter(Boolean), autoExpandedIds: toExpand }
    }, [categoryTree, searchQuery])

    const toggleExpand = (id) => setExpandedIds(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })

    const toggleRulesExpand = (id, forceOpen = false) => setRulesExpandedIds(prev => {
        const next = new Set(prev)
        if (forceOpen || !next.has(id)) next.add(id); else next.delete(id)
        return next
    })

    const isExpanded = (id) => searchQuery.trim() ? autoExpandedIds.has(id) : expandedIds.has(id)

    const totalRulesLinked = useMemo(() => new Set(rules.map(r => r.target_category_id).filter(Boolean)).size, [rules])
    const nonSystemCatIds = useMemo(() => categories.filter(c => !isSystemCategory(c)).map(c => c.id), [categories])
    const allRulesExpanded = nonSystemCatIds.length > 0 && nonSystemCatIds.every(id => rulesExpandedIds.has(id))
    const toggleAllRules = () => {
        if (allRulesExpanded) setRulesExpandedIds(new Set())
        else setRulesExpandedIds(new Set(nonSystemCatIds))
    }
    const parentCategoryForPanel = panel?.mode === 'add' && panel.parentId
        ? categories.find(c => c.id === panel.parentId) : null

    const treeCtxValue = {
        rules, categories, draggedId, setDraggedId, dropTarget, setDropTarget,
        panel, isSystemCategory, isExpanded, toggleExpand,
        openAdd, openEdit, handleDelete, onDragStart, onDrop,
        rulesExpandedIds, toggleRulesExpand,
        addingRuleTo, setAddingRuleTo, newRulePattern, setNewRulePattern,
        newAmountCondition, setNewAmountCondition, handleCreateRule,
        handleDeleteRule, setEditingRule,
    }

    // ── Shared inline rule input for labels/transfers ──────────────────────

    const InlineRuleInput = ({ activeKey, targetId, type, pattern, setPattern, addingKey, setAddingKey }) =>
        addingKey === activeKey ? (
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem' }}>
                <input
                    autoFocus type="text" className="form-control"
                    placeholder="e.g. TRANSFER.*"
                    style={{ flex: 1, fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                    value={pattern}
                    onChange={e => setPattern(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleCreateRule(targetId, type)
                        if (e.key === 'Escape') setAddingKey(null)
                    }}
                />
                <button onClick={() => handleCreateRule(targetId, type)} className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>Add</button>
                <button onClick={() => setAddingKey(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', cursor: 'pointer' }}><X size={13} /></button>
            </div>
        ) : null

    const LabelRuleChip = ({ rule }) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(99,102,241,0.06)', padding: '0.3rem 0.6rem', borderRadius: '0.4rem', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.8rem' }}>
            <Hash size={10} style={{ color: 'var(--text-muted)' }} />
            <code style={{ fontSize: '0.8rem' }}>{rule.pattern}</code>
            <button onClick={() => setEditingRule(rule)} style={{ background: 'none', border: 'none', padding: '1px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            ><Edit3 size={11} /></button>
            <button onClick={() => handleDeleteRule(rule.id)} style={{ background: 'none', border: 'none', padding: '1px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            ><Trash2 size={11} /></button>
        </div>
    )

    return (
        <TreeCtx.Provider value={treeCtxValue}>
            <div className="animate-fade-in">
                {/* Header */}
                <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ margin: '0 0 0.2rem 0' }}>Categories</h1>
                        <p className="text-muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                            {categories.length} categories · {totalRulesLinked} linked to rules
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input type="text" placeholder="Search..." className="form-control" style={{ paddingLeft: '2.25rem', width: '170px' }}
                                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <button onClick={toggleAllRules} style={{ background: allRulesExpanded ? 'rgba(99,102,241,0.15)' : 'var(--bg-surface)', border: `1px solid ${allRulesExpanded ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`, color: allRulesExpanded ? 'var(--primary-light)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.48rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                            <Hash size={14} /> {allRulesExpanded ? 'Hide Rules' : 'Show Rules'}
                        </button>
                        <label style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', padding: '0.48rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            <FileUp size={14} /> Import
                            <input type="file" accept=".json" onChange={importRules} style={{ display: 'none' }} />
                        </label>
                        <button onClick={exportRules} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.48rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <Download size={14} /> Export
                        </button>
                        <button onClick={handleReCategorize} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                            <Tag size={14} /> Re-apply Rules
                        </button>
                        <button onClick={() => openAdd(null)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                            <Plus size={15} /> New Category
                        </button>
                    </div>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: panel ? '1fr 300px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Category tree with inline rules */}
                        <div className="glass-card" style={{ padding: '1.25rem' }}>
                            {loading ? (
                                <div style={{ padding: '4rem', textAlign: 'center' }}><div className="spinner" /></div>
                            ) : filteredTree.length === 0 ? (
                                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {searchQuery ? (
                                        <><Search size={40} style={{ opacity: 0.15, display: 'block', margin: '0 auto 1rem' }} /><div style={{ fontWeight: 500 }}>No results for "{searchQuery}"</div></>
                                    ) : (
                                        <><Tag size={40} style={{ opacity: 0.15, display: 'block', margin: '0 auto 1rem' }} /><div style={{ fontWeight: 500 }}>No categories yet</div><div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Click "New Category" to get started</div></>
                                    )}
                                </div>
                            ) : (
                                filteredTree.map(root => <CategoryNode key={root.id} node={root} />)
                            )}
                        </div>

                        {/* Internal Transfers */}
                        <div className="glass-card" style={{ padding: 0, border: '1px solid rgba(16,185,129,0.3)' }}>
                            <button
                                onClick={() => setTransfersOpen(o => !o)}
                                style={{ width: '100%', background: 'none', border: 'none', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', textAlign: 'left' }}
                            >
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', flexShrink: 0 }}>
                                    <ChevronRight size={16} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Internal Transfers</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rules to identify money moving between accounts</div>
                                </div>
                                {transfersOpen ? <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />}
                            </button>

                            {transfersOpen && (
                                <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {accounts.map(account => {
                                        const accountRules = rules.filter(r => r.target_account_id === account.id)
                                        return (
                                            <div key={account.id}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>→ {account.name}</span>
                                                    <button
                                                        onClick={() => { setAddingTransferRuleTo(account.id); setTransferRulePattern('') }}
                                                        style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', display: 'flex' }}
                                                    ><PlusCircle size={15} /></button>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                    {accountRules.map(rule => <LabelRuleChip key={rule.id} rule={rule} />)}
                                                    {accountRules.length === 0 && addingTransferRuleTo !== account.id && (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No rules</span>
                                                    )}
                                                </div>
                                                <InlineRuleInput
                                                    activeKey={account.id} targetId={account.id} type="account"
                                                    pattern={transferRulePattern} setPattern={setTransferRulePattern}
                                                    addingKey={addingTransferRuleTo} setAddingKey={setAddingTransferRuleTo}
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Labels */}
                        <div className="glass-card" style={{ padding: 0, border: '1px solid rgba(99,102,241,0.3)' }}>
                            <button
                                onClick={() => setLabelsOpen(o => !o)}
                                style={{ width: '100%', background: 'none', border: 'none', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', textAlign: 'left' }}
                            >
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                                    <Tag size={16} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Labels</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Many-to-many tags applied via rules</div>
                                </div>
                                {labelsOpen ? <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />}
                            </button>

                            {labelsOpen && (
                                <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {labels.length === 0 && !addingLabel && (
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No labels yet.</p>
                                    )}
                                    {labels.map(label => {
                                        const labelRules = rules.filter(r => r.target_label_id === label.id)
                                        return (
                                            <div key={label.id}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: label.color }} />
                                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label.name}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => { setAddingLabelRuleTo(label.id); setLabelRulePattern('') }}
                                                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex' }}
                                                    ><PlusCircle size={15} /></button>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                    {labelRules.map(rule => <LabelRuleChip key={rule.id} rule={rule} />)}
                                                    {labelRules.length === 0 && addingLabelRuleTo !== label.id && (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No rules</span>
                                                    )}
                                                </div>
                                                <InlineRuleInput
                                                    activeKey={label.id} targetId={label.id} type="label"
                                                    pattern={labelRulePattern} setPattern={setLabelRulePattern}
                                                    addingKey={addingLabelRuleTo} setAddingKey={setAddingLabelRuleTo}
                                                />
                                            </div>
                                        )
                                    })}

                                    {/* Add label */}
                                    {addingLabel ? (
                                        <form onSubmit={handleCreateLabel} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: labels.length > 0 ? '0.25rem' : 0 }}>
                                            <input
                                                autoFocus type="text" className="form-control" placeholder="Label name"
                                                style={{ flex: 1, fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                                                value={newLabelName} onChange={e => setNewLabelName(e.target.value)} required
                                            />
                                            <input type="color"
                                                style={{ width: '36px', height: '36px', padding: '3px', borderRadius: '0.4rem', border: '1px solid var(--border)', background: 'var(--bg-deep)', cursor: 'pointer', flexShrink: 0 }}
                                                value={newLabelColor} onChange={e => setNewLabelColor(e.target.value)}
                                            />
                                            <button type="submit" className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>Create</button>
                                            <button type="button" onClick={() => setAddingLabel(false)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', cursor: 'pointer' }}><X size={13} /></button>
                                        </form>
                                    ) : (
                                        <button
                                            onClick={() => setAddingLabel(true)}
                                            style={{ background: 'none', border: '1px dashed rgba(99,102,241,0.3)', color: 'var(--primary)', padding: '0.3rem 0.75rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', alignSelf: 'flex-start', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                        >
                                            <Plus size={12} /> New Label
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Side panel */}
                    {panel ? (
                        <div className="glass-card" style={{ padding: '1.5rem', position: 'sticky', top: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                                    {panel.mode === 'edit' ? 'Edit Category' : 'New Category'}
                                </h3>
                                <button onClick={closePanel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '0.2rem' }}>
                                    <X size={17} />
                                </button>
                            </div>

                            {parentCategoryForPanel && (
                                <div style={{ marginBottom: '1.25rem', padding: '0.5rem 0.75rem', background: 'rgba(99,102,241,0.07)', borderRadius: '0.5rem', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    Under: <span style={{ color: 'var(--primary-light)', fontWeight: 600 }}>{parentCategoryForPanel.name}</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                                <div>
                                    <label style={labelStyle}>Name</label>
                                    <input className="form-control" placeholder="e.g. Groceries" value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
                                </div>
                                <div>
                                    <label style={labelStyle}>Parent</label>
                                    <select className="form-control" value={formParentId} onChange={e => setFormParentId(e.target.value)}>
                                        <option value="">None (Root)</option>
                                        {categories
                                            .filter(c => !isSystemCategory(c) && (panel.mode !== 'edit' || c.id !== panel.cat.id))
                                            .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                        }
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Type</label>
                                    <div style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                        <button onClick={() => setFormIsIncome(false)} style={{ flex: 1, padding: '0.55rem', background: !formIsIncome ? 'rgba(239,68,68,0.15)' : 'transparent', color: !formIsIncome ? '#f87171' : 'var(--text-muted)', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.15s' }}>Expense</button>
                                        <button onClick={() => setFormIsIncome(true)} style={{ flex: 1, padding: '0.55rem', background: formIsIncome ? 'rgba(16,185,129,0.15)' : 'transparent', color: formIsIncome ? 'var(--success)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.15s' }}>Income</button>
                                    </div>
                                </div>
                                {formError && (
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.65rem 0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5rem', fontSize: '0.82rem', color: '#f87171' }}>
                                        <AlertCircle size={15} style={{ flexShrink: 0 }} />{formError}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '0.6rem' }}>
                                    <button onClick={handleSave} disabled={formSaving} className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                        <Check size={15} />{formSaving ? 'Saving…' : (panel.mode === 'edit' ? 'Save' : 'Create')}
                                    </button>
                                    <button onClick={closePanel} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                                </div>
                                {panel.mode === 'edit' && !isSystemCategory(panel.cat) && (
                                    <button onClick={() => handleDelete(panel.cat)}
                                        style={{ background: 'none', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', padding: '0.55rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'background 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                    ><Trash2 size={13} /> Delete category</button>
                                )}
                            </div>
                        </div>
                    ) : !loading && categories.length > 0 && (
                        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', position: 'sticky', top: '1rem' }}>
                            <Layers size={36} style={{ opacity: 0.15, marginBottom: '0.75rem' }} />
                            <div style={{ fontSize: '0.82rem' }}>
                                Click the <strong>rules</strong> badge to manage rules inline, or hover a row for actions.
                            </div>
                        </div>
                    )}
                </div>

                <style dangerouslySetInnerHTML={{ __html: `
                    .cat-row:hover { background: rgba(255,255,255,0.04) !important; }
                    .cat-actions { opacity: 0; transition: opacity 0.15s; }
                    .cat-row:hover .cat-actions { opacity: 1; }
                    .cat-action-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.3rem; border-radius: 0.3rem; display: flex; align-items: center; transition: background 0.15s, color 0.15s; }
                    .cat-action-btn:hover { background: rgba(255,255,255,0.08); color: var(--primary-light); }
                    .cat-action-btn.cat-action-danger:hover { background: rgba(239,68,68,0.1); color: #f87171; }
                    .spinner { width: 36px; height: 36px; border: 3px solid rgba(99,102,241,0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}} />

                {notification && <Notification type={notification.type} message={notification.message} onClose={() => setNotification(null)} />}

                {editingRule && (
                    <EditRuleModal
                        rule={editingRule}
                        categories={categories}
                        accounts={accounts}
                        labels={labels}
                        onClose={() => setEditingRule(null)}
                        onRuleUpdated={(data) => {
                            fetchData()
                            setNotification({ type: 'success', message: `Rule updated! ${data.changes} transactions updated (${data.matches} matches found).` })
                        }}
                    />
                )}
            </div>
        </TreeCtx.Provider>
    )
}

const labelStyle = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--text-muted)', marginBottom: '0.35rem',
    textTransform: 'uppercase', letterSpacing: '0.05em'
}

export default CategoryManagement
