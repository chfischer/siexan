import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { X, Tag, AlertCircle, Hash } from 'lucide-react'

function EditRuleModal({ rule, categories, accounts, labels, onClose, onRuleUpdated }) {
    const [pattern, setPattern] = useState(rule.pattern)
    const [mode, setMode] = useState(
        rule.target_account_id ? 'transfer' :
            rule.target_label_id ? 'label' : 'category'
    )
    const [selectedCategoryId, setSelectedCategoryId] = useState(rule.target_category_id || '')
    const [selectedAccountId, setSelectedAccountId] = useState(rule.target_account_id || '')
    const [selectedLabelId, setSelectedLabelId] = useState(rule.target_label_id || '')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleSave = async () => {
        if (!pattern.trim()) return

        setLoading(true)
        try {
            const payload = {
                pattern: pattern,
                target_category_id: mode === 'category' ? parseInt(selectedCategoryId) : null,
                target_account_id: mode === 'transfer' ? parseInt(selectedAccountId) : null,
                target_label_id: mode === 'label' ? parseInt(selectedLabelId) : null
            }

            const res = await axios.put(`/api/rules/${rule.id}`, payload)
            onRuleUpdated(res.data)
            onClose()
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to update rule')
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
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: 'var(--bg-card)',
                width: '100%',
                maxWidth: '500px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: '1.25rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(to right, rgba(99, 102, 241, 0.05), transparent)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                            <Tag size={18} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Edit Rule #{rule.id}</h3>
                    </div>
                    <button onClick={onClose} className="btn-icon">
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                            <Hash size={14} className="text-muted" /> Match Pattern (Regex)
                        </label>
                        <input
                            type="text"
                            className="form-control"
                            value={pattern}
                            onChange={(e) => setPattern(e.target.value)}
                            placeholder="e.g. UBER.*"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Action Mode</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                            <button
                                onClick={() => setMode('category')}
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid',
                                    borderColor: mode === 'category' ? 'var(--primary)' : 'var(--border)',
                                    background: mode === 'category' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                    color: mode === 'category' ? 'var(--primary)' : 'var(--text-muted)',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Category
                            </button>
                            <button
                                onClick={() => setMode('transfer')}
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid',
                                    borderColor: mode === 'transfer' ? 'var(--success)' : 'var(--border)',
                                    background: mode === 'transfer' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                    color: mode === 'transfer' ? 'var(--success)' : 'var(--text-muted)',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Transfer
                            </button>
                            <button
                                onClick={() => setMode('label')}
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid',
                                    borderColor: mode === 'label' ? 'var(--primary)' : 'var(--border)',
                                    background: mode === 'label' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                    color: mode === 'label' ? 'var(--primary)' : 'var(--text-muted)',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Label
                            </button>
                        </div>
                    </div>

                    {mode === 'category' && (
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Select Category</label>
                            <select
                                className="form-control"
                                value={selectedCategoryId}
                                onChange={(e) => setSelectedCategoryId(e.target.value)}
                            >
                                <option value="">Select a category...</option>
                                {[...categories]
                                    .map(cat => ({
                                        ...cat,
                                        fullPath: (() => {
                                            const getPath = (id) => {
                                                const c = categories.find(x => x.id === id)
                                                if (!c) return ''
                                                if (!c.parent_id) return c.name
                                                return `${getPath(c.parent_id)} / ${c.name}`
                                            }
                                            return getPath(cat.id)
                                        })()
                                    }))
                                    .sort((a, b) => a.fullPath.localeCompare(b.fullPath))
                                    .map(c => <option key={c.id} value={c.id}>{c.fullPath}</option>)
                                }
                            </select>
                        </div>
                    )}

                    {mode === 'transfer' && (
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Select Target Account</label>
                            <select
                                className="form-control"
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                            >
                                <option value="">Select an account...</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    )}

                    {mode === 'label' && (
                        <div className="form-group">
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Select Label</label>
                            <select
                                className="form-control"
                                value={selectedLabelId}
                                onChange={(e) => setSelectedLabelId(e.target.value)}
                            >
                                <option value="">Select a label...</option>
                                {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    )}

                    {error && (
                        <div style={{ padding: '0.75rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            onClick={handleSave}
                            disabled={loading || !pattern.trim()}
                            className="btn-primary"
                            style={{ flex: 1, padding: '0.75rem' }}
                        >
                            {loading ? 'Updating...' : 'Update Rule'}
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                background: 'transparent',
                                color: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
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
                .btn-icon {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.5rem;
                    border-radius: 50%;
                    transition: background 0.2s;
                }
                .btn-icon:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: white;
                }
            `}} />
        </div>
    )
}

export default EditRuleModal
