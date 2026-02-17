import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { X, Tag, PlusCircle, AlertCircle } from 'lucide-react'

function QuickCategorizeModal({ transaction, onClose, onRuleCreated }) {
    const [categories, setCategories] = useState([])
    const [accounts, setAccounts] = useState([])
    const [labels, setLabels] = useState([])
    const [mode, setMode] = useState('category') // 'category', 'transfer', or 'label'
    const [selectedCategoryId, setSelectedCategoryId] = useState('')
    const [selectedAccountId, setSelectedAccountId] = useState('')
    const [selectedLabelId, setSelectedLabelId] = useState('')
    const [pattern, setPattern] = useState(transaction.description)
    const [showAddNewCategory, setShowAddNewCategory] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newLabelName, setNewLabelName] = useState('')
    const [newLabelColor, setNewLabelColor] = useState('#6366f1')
    const [showAddNewLabel, setShowAddNewLabel] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        const fetchListData = async () => {
            try {
                const [catRes, accRes, labRes] = await Promise.all([
                    axios.get('/api/categories/'),
                    axios.get('/api/accounts/'),
                    axios.get('/api/labels/')
                ])
                setCategories(catRes.data)
                setAccounts(accRes.data)
                setLabels(labRes.data)
            } catch (err) {
                setError('Failed to load data')
            }
        }
        fetchListData()
    }, [])

    const handleSave = async () => {
        if (!pattern.trim()) return

        setLoading(true)
        try {
            let targetCategoryId = selectedCategoryId
            let targetLabelId = selectedLabelId

            // 1. Create new category/label if needed
            if (mode === 'category' && showAddNewCategory) {
                const catRes = await axios.post('/api/categories/', { name: newCategoryName })
                targetCategoryId = catRes.data.id
            }

            if (mode === 'label' && showAddNewLabel) {
                const labRes = await axios.post('/api/labels/', { name: newLabelName, color: newLabelColor })
                targetLabelId = labRes.data.id
            }

            // 2. Create the rule
            await axios.post('/api/rules/', {
                pattern: pattern,
                target_category_id: mode === 'category' ? parseInt(targetCategoryId) : null,
                target_account_id: mode === 'transfer' ? parseInt(selectedAccountId) : null,
                target_label_id: mode === 'label' ? parseInt(targetLabelId) : null
            })

            // 3. Trigger re-categorization
            await axios.post('/api/rules/re-categorize/')

            onRuleCreated()
            onClose()
        } catch (err) {
            setError('Failed to process request')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="glass-card" style={{ width: '450px', position: 'relative' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', right: '1.25rem', top: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)' }}
                >
                    <X size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                        <Tag size={20} />
                    </div>
                    <h2 style={{ margin: 0 }}>Quick Categorize</h2>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label className="text-muted small" style={{ display: 'block', marginBottom: '0.25rem' }}>Transaction Description</label>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.9rem' }}>
                        {transaction.description}
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="small" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Matching Pattern</label>
                    <input
                        type="text"
                        className="form-control"
                        value={pattern}
                        onChange={(e) => setPattern(e.target.value)}
                        placeholder="e.g. COOP or UBER.*"
                        autoFocus
                    />
                    <div className="text-muted x-small" style={{ marginTop: '0.6rem', padding: '0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.4rem', border: '1px solid var(--border)' }}>
                        <p style={{ margin: '0 0 0.4rem 0', fontWeight: 600 }}>Pattern Examples:</p>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <li><code>COOP</code> - Simple keyword match</li>
                            <li><code>UBER.*EATS</code> - Matches both words in order</li>
                            <li><code>^START</code> - Matches beginning of text</li>
                        </ul>
                    </div>
                </div>

                {error && (
                    <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem', border: '1px solid var(--danger)', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                    <button
                        onClick={() => setMode('category')}
                        style={{
                            flex: 'none',
                            padding: '0.5rem 0.8rem',
                            borderRadius: '0.5rem',
                            border: '1px solid ' + (mode === 'category' ? 'var(--primary)' : 'var(--border)'),
                            background: mode === 'category' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            color: mode === 'category' ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600
                        }}
                    >
                        Category
                    </button>
                    <button
                        onClick={() => setMode('label')}
                        style={{
                            flex: 'none',
                            padding: '0.5rem 0.8rem',
                            borderRadius: '0.5rem',
                            border: '1px solid ' + (mode === 'label' ? 'var(--primary)' : 'var(--border)'),
                            background: mode === 'label' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            color: mode === 'label' ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600
                        }}
                    >
                        Labeling
                    </button>
                    <button
                        onClick={() => setMode('transfer')}
                        style={{
                            flex: 'none',
                            padding: '0.5rem 0.8rem',
                            borderRadius: '0.5rem',
                            border: '1px solid ' + (mode === 'transfer' ? 'var(--success)' : 'var(--border)'),
                            background: mode === 'transfer' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            color: mode === 'transfer' ? 'var(--success)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600
                        }}
                    >
                        Transfer
                    </button>
                </div>

                {mode === 'category' && (
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label className="small" style={{ fontWeight: 600 }}>
                                {showAddNewCategory ? 'New Category Name' : 'Select Category'}
                            </label>
                            <button
                                onClick={() => setShowAddNewCategory(!showAddNewCategory)}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                {showAddNewCategory ? 'Select Existing' : '+ New Category'}
                            </button>
                        </div>

                        {showAddNewCategory ? (
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. Shopping"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                autoFocus
                            />
                        ) : (
                            <select
                                className="form-control"
                                value={selectedCategoryId}
                                onChange={(e) => setSelectedCategoryId(e.target.value)}
                                required
                            >
                                <option value="">Select a category...</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {mode === 'label' && (
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label className="small" style={{ fontWeight: 600 }}>
                                {showAddNewLabel ? 'New Label Name' : 'Select Label'}
                            </label>
                            <button
                                onClick={() => setShowAddNewLabel(!showAddNewLabel)}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                {showAddNewLabel ? 'Select Existing' : '+ New Label'}
                            </button>
                        </div>

                        {showAddNewLabel ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Subscription"
                                    value={newLabelName}
                                    onChange={(e) => setNewLabelName(e.target.value)}
                                    autoFocus
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label className="x-small">Color:</label>
                                    <input
                                        type="color"
                                        value={newLabelColor}
                                        onChange={(e) => setNewLabelColor(e.target.value)}
                                        style={{ width: '30px', height: '30px', border: 'none', background: 'none', padding: 0 }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <select
                                className="form-control"
                                value={selectedLabelId}
                                onChange={(e) => setSelectedLabelId(e.target.value)}
                                required
                            >
                                <option value="">Select a label...</option>
                                {labels.map(lbl => (
                                    <option key={lbl.id} value={lbl.id}>{lbl.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {mode === 'transfer' && (
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="small" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Target Account</label>
                        <select
                            className="form-control"
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            required
                        >
                            <option value="">Select internal account...</option>
                            {accounts.filter(a => a.id !== transaction.account_id).map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                        <p className="text-muted small" style={{ marginTop: '0.5rem' }}>Money moving to this account won't count as an expense.</p>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={handleSave}
                        className="btn-primary"
                        style={{ flex: 1, padding: '0.75rem', fontSize: '1rem' }}
                        disabled={loading || (
                            mode === 'category' ? (showAddNewCategory ? !newCategoryName.trim() : !selectedCategoryId) :
                                mode === 'label' ? (showAddNewLabel ? !newLabelName.trim() : !selectedLabelId) :
                                    !selectedAccountId
                        )}
                    >
                        {loading ? 'Processing...' : 'Create Rule & Categorize'}
                    </button>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: '1px solid var(--border)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.5rem' }}
                    >
                        Cancel
                    </button>
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
                    }
                    .text-muted { color: var(--text-muted); }
                    .small { font-size: 0.875rem; }
                `}} />
            </div>
        </div>
    )
}

export default QuickCategorizeModal
