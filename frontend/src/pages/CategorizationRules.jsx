import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Trash2, Tag, Hash, AlertCircle, Search, ChevronRight, PlusCircle, Download, FileUp, Edit3 } from 'lucide-react'
import EditRuleModal from '../components/EditRuleModal'
import Notification from '../components/Notification'

function CategorizationRules({ refreshTrigger }) {
    const [categories, setCategories] = useState([])
    const [accounts, setAccounts] = useState([])
    const [labels, setLabels] = useState([])
    const [rules, setRules] = useState([])
    const [stats, setStats] = useState({ total: 0, uncategorized: 0 })
    const [notification, setNotification] = useState(null)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newLabelName, setNewLabelName] = useState('')
    const [newLabelColor, setNewLabelColor] = useState('#6366f1')
    const [addingRuleTo, setAddingRuleTo] = useState(null) // ID of category, label or 'transfer'
    const [newRulePattern, setNewRulePattern] = useState('')
    const [error, setError] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [editingRule, setEditingRule] = useState(null)

    useEffect(() => {
        fetchData()
    }, [refreshTrigger])

    const fetchData = async () => {
        try {
            const [catRes, ruleRes, statsRes, accRes, labelRes] = await Promise.all([
                axios.get('/api/categories/'),
                axios.get('/api/rules/'),
                axios.get('/api/transactions/stats'),
                axios.get('/api/accounts/'),
                axios.get('/api/labels/')
            ])
            setCategories(catRes.data)
            setRules(ruleRes.data)
            setStats(statsRes.data)
            setAccounts(accRes.data)
            setLabels(labelRes.data)
        } catch (err) {
            setError('Failed to fetch data from backend')
        }
    }

    const handleCreateCategory = async (e) => {
        e.preventDefault()
        if (!newCategoryName.trim()) return
        try {
            await axios.post('/api/categories/', { name: newCategoryName })
            setNewCategoryName('')
            fetchData()
        } catch (err) {
            setError('Failed to create category')
        }
    }

    const handleCreateRule = async (target, type = 'category') => {
        if (!newRulePattern.trim()) return
        try {
            const payload = {
                pattern: newRulePattern,
                target_category_id: type === 'category' ? target : null,
                target_account_id: type === 'account' ? target : null,
                target_label_id: type === 'label' ? target : null
            }
            const res = await axios.post('/api/rules/', payload)
            setNewRulePattern('')
            setAddingRuleTo(null)
            fetchData()
            setNotification({
                type: 'success',
                message: `Rule created! ${res.data.changes} transactions updated (${res.data.matches} matches found).`
            })
        } catch (err) {
            setError('Failed to create matching rule')
        }
    }

    const handleCreateLabel = async (e) => {
        e.preventDefault()
        if (!newLabelName.trim()) return
        try {
            await axios.post('/api/labels/', { name: newLabelName, color: newLabelColor })
            setNewLabelName('')
            fetchData()
        } catch (err) {
            setError('Failed to create label')
        }
    }

    const handleDeleteRule = async (id) => {
        try {
            await axios.delete(`/api/rules/${id}`)
            fetchData()
        } catch (err) {
            setError('Failed to delete rule')
        }
    }

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
            fetchData() // Refresh stats
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to re-categorize transactions')
        }
    }

    const exportRules = async () => {
        try {
            const res = await axios.get('/api/rules/export/')
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "siexan_rules_backup.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            setNotification({ type: 'success', message: 'Rules exported successfully' })
        } catch (err) {
            setError('Failed to export rules')
        }
    }

    const importRules = async (e) => {
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
                setError('Error importing rules: ' + (err.response?.data?.detail || "Invalid JSON"))
            }
        }
        reader.readAsText(file)
        e.target.value = null
    }

    const getCategoryPath = (catId) => {
        const cat = categories.find(c => c.id === catId)
        if (!cat) return 'Uncategorized'
        if (!cat.parent_id) return cat.name
        return `${getCategoryPath(cat.parent_id)} / ${cat.name}`
    }

    const filteredCategories = categories
        .map(cat => ({ ...cat, fullPath: getCategoryPath(cat.id) }))
        .filter(cat => cat.fullPath.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => a.fullPath.localeCompare(b.fullPath))

    return (
        <div className="rules-page">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1>Categorization Management</h1>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', borderRadius: '1rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                            Total: <strong>{stats.total}</strong>
                        </span>
                        <span style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', borderRadius: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
                            Uncategorized: <strong>{stats.uncategorized}</strong>
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <label className="btn-primary" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem' }}>
                        <FileUp size={18} /> Import JSON
                        <input type="file" accept=".json" onChange={importRules} style={{ display: 'none' }} />
                    </label>
                    <button
                        onClick={exportRules}
                        className="btn-primary"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                    >
                        <Download size={18} /> Export JSON
                    </button>
                    <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 0.5rem' }}></div>
                    <button
                        onClick={handleReCategorize}
                        className="btn-primary"
                        style={{ background: 'var(--success)', borderColor: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Tag size={18} /> Re-apply Rules
                    </button>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search categories..."
                            className="form-control"
                            style={{ paddingLeft: '2.5rem', width: '300px' }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            {error && (
                <div className="alert alert-error" style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '0.5rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={18} /> {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
                {/* Main Content: Categories & Rules */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Special Transfers Section */}
                    <div className="glass-card" style={{ padding: '0', border: '1px solid var(--success)' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                                    <ChevronRight size={20} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0 }}>Internal Transfers</h3>
                                    <span className="text-muted small">Rules to identify money moving between accounts</span>
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '1.25rem' }}>
                            {accounts.map(account => {
                                const accountRules = rules.filter(r => r.target_account_id === account.id)
                                return (
                                    <div key={account.id} style={{ marginBottom: '1.5rem', lastChild: { marginBottom: 0 } }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                To: {account.name}
                                            </div>
                                            <button
                                                onClick={() => setAddingRuleTo(addingRuleTo === `acc-${account.id}` ? null : `acc-${account.id}`)}
                                                className="btn-icon"
                                                style={{ color: 'var(--primary)' }}
                                            >
                                                <PlusCircle size={16} />
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {accountRules.map(rule => (
                                                <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.4rem', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                        <Hash size={12} />
                                                        <span>{rule.id}</span>
                                                    </div>
                                                    <code>{rule.pattern}</code>
                                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                        <button onClick={() => setEditingRule(rule)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer', opacity: 0.6 }}>
                                                            <Edit3 size={12} />
                                                        </button>
                                                        <button onClick={() => handleDeleteRule(rule.id)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--danger)', cursor: 'pointer', opacity: 0.6 }}>
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {addingRuleTo === `acc-${account.id}` && (
                                            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Enter regex pattern..."
                                                    style={{ flex: 1, fontSize: '0.875rem' }}
                                                    value={newRulePattern}
                                                    onChange={(e) => setNewRulePattern(e.target.value)}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleCreateRule(account.id, 'account')}
                                                    autoFocus
                                                />
                                                <button onClick={() => handleCreateRule(account.id, 'account')} className="btn-primary" style={{ padding: '0 1rem' }}>Add</button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Labels Section */}
                    <div className="glass-card" style={{ padding: '0', border: '1px solid var(--primary)' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                    <Tag size={20} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0 }}>Labels (Many-to-Many)</h3>
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '1.25rem' }}>
                            {labels.map(label => {
                                const labelRules = rules.filter(r => r.target_label_id === label.id)
                                return (
                                    <div key={label.id} style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: label.color }}></div>
                                                <span style={{ fontWeight: 600 }}>{label.name}</span>
                                            </div>
                                            <button
                                                onClick={() => setAddingRuleTo(addingRuleTo === `label-${label.id}` ? null : `label-${label.id}`)}
                                                className="btn-icon"
                                                style={{ color: 'var(--primary)' }}
                                            >
                                                <PlusCircle size={16} />
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {labelRules.map(rule => (
                                                <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.4rem', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                        <Hash size={12} />
                                                        <span>{rule.id}</span>
                                                    </div>
                                                    <code>{rule.pattern}</code>
                                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                        <button onClick={() => setEditingRule(rule)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer', opacity: 0.6 }}>
                                                            <Edit3 size={12} />
                                                        </button>
                                                        <button onClick={() => handleDeleteRule(rule.id)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--danger)', cursor: 'pointer', opacity: 0.6 }}>
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {addingRuleTo === `label-${label.id}` && (
                                            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Enter regex pattern..."
                                                    style={{ flex: 1, fontSize: '0.875rem' }}
                                                    value={newRulePattern}
                                                    onChange={(e) => setNewRulePattern(e.target.value)}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleCreateRule(label.id, 'label')}
                                                    autoFocus
                                                />
                                                <button onClick={() => handleCreateRule(label.id, 'label')} className="btn-primary" style={{ padding: '0 1rem' }}>Add</button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {filteredCategories.map(category => {
                        const categoryRules = rules.filter(r => r.target_category_id === category.id)
                        return (
                            <div key={category.id} className="glass-card" style={{ padding: '0' }}>
                                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                            <Tag size={20} />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0 }}>{category.fullPath}</h3>
                                            <span className="text-muted small">{categoryRules.length} matching rules</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setAddingRuleTo(addingRuleTo === category.id ? null : category.id)}
                                        className="btn-primary"
                                        style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                                    >
                                        <PlusCircle size={16} /> Add Rule
                                    </button>
                                </div>

                                <div style={{ padding: '1.25rem' }}>
                                    {addingRuleTo === category.id && (
                                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', border: '1px dashed var(--primary)' }}>
                                            <label className="small" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>New Matching Pattern</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. UBER.* or STARBUCKS"
                                                    value={newRulePattern}
                                                    onChange={(e) => setNewRulePattern(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateRule(category.id, 'category')}
                                                />
                                                <button onClick={() => handleCreateRule(category.id, 'category')} className="btn-primary">Save</button>
                                                <button onClick={() => setAddingRuleTo(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>Cancel</button>
                                            </div>
                                            <p className="text-muted x-small" style={{ marginTop: '0.5rem' }}>Use <code>.*</code> for wildcards. Patterns are case-insensitive.</p>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                        {categoryRules.map(rule => (
                                            <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                    <Hash size={12} />
                                                    <span>{rule.id}</span>
                                                </div>
                                                <code style={{ fontSize: '0.9rem' }}>{rule.pattern}</code>
                                                <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.25rem' }}>
                                                    <button
                                                        onClick={() => setEditingRule(rule)}
                                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', padding: '2px', cursor: 'pointer' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                                    >
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRule(rule.id)}
                                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', padding: '2px', cursor: 'pointer' }}
                                                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {categoryRules.length === 0 && !addingRuleTo && (
                                            <p className="text-muted small italic">No specific patterns defined. This category will only be used by AI or exact matches.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Sidebar: Add Category */}
                <div style={{ position: 'sticky', top: '2rem' }}>
                    <div className="glass-card">
                        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>New Category</h2>
                        <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="small" style={{ display: 'block', marginBottom: '0.5rem' }}>Category Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Entertainment"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="btn-primary w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <Plus size={18} /> Create Category
                            </button>
                        </form>
                    </div>

                    <div className="glass-card" style={{ marginTop: '1.5rem' }}>
                        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>New Label</h2>
                        <form onSubmit={handleCreateLabel} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="small" style={{ display: 'block', marginBottom: '0.5rem' }}>Label Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Subscription"
                                    value={newLabelName}
                                    onChange={(e) => setNewLabelName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="small" style={{ display: 'block', marginBottom: '0.5rem' }}>Color</label>
                                <input
                                    type="color"
                                    className="form-control"
                                    style={{ height: '40px', padding: '5px' }}
                                    value={newLabelColor}
                                    onChange={(e) => setNewLabelColor(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="btn-primary w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <Plus size={18} /> Create Label
                            </button>
                        </form>
                    </div>

                    <div className="glass-card" style={{ marginTop: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <AlertCircle size={16} className="text-primary" /> Pro Tip
                        </h4>
                        <p className="text-muted small">
                            Categories are the heart of your budget. Add broad patterns to catch most transactions, and the AI Waterfall will handle the rest!
                        </p>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .form-control {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    background: var(--bg-deep);
                    border: 1px solid var(--border);
                    color: white;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .form-control:focus {
                    border-color: var(--primary);
                }
                .w-full { width: 100%; }
                .small { font-size: 0.875rem; }
                .x-small { font-size: 0.75rem; }
                .italic { font-style: italic; }
            `}} />

            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            {editingRule && (
                <EditRuleModal
                    rule={editingRule}
                    categories={categories}
                    accounts={accounts}
                    labels={labels}
                    onClose={() => setEditingRule(null)}
                    onRuleUpdated={(data) => {
                        fetchData()
                        setNotification({
                            type: 'success',
                            message: `Rule updated! ${data.changes} transactions updated (${data.matches} matches found).`
                        })
                    }}
                />
            )}
        </div>
    )
}

export default CategorizationRules
