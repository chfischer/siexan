import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { ArrowUp, ArrowDown, Trash2, ArrowLeft, Tag, Zap, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import Notification from '../components/Notification'

const Rules = () => {
    const [rules, setRules] = useState([])
    const [loading, setLoading] = useState(true)
    const [notification, setNotification] = useState(null)
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    useEffect(() => {
        const fetchRules = async () => {
            setLoading(true)
            try {
                const res = await axios.get('/api/rules/')
                setRules(res.data)
            } catch (err) {
                console.error("Error fetching rules", err)
                setNotification({ type: 'error', message: "Failed to fetch rules" })
            } finally {
                setLoading(false)
            }
        }
        fetchRules()
    }, [refreshTrigger])

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this rule?")) return
        try {
            await axios.delete(`/api/rules/${id}`)
            setNotification({ type: 'success', message: "Rule deleted" })
            setRefreshTrigger(prev => prev + 1)
        } catch (err) {
            console.error("Error deleting rule", err)
            setNotification({ type: 'error', message: "Failed to delete rule" })
        }
    }

    const moveRule = async (index, direction) => {
        const newRules = [...rules]
        const otherIndex = index + direction
        if (otherIndex < 0 || otherIndex >= newRules.length) return

        // Swap priority numbers
        const ruleA = newRules[index]
        const ruleB = newRules[otherIndex]

        const priorityA = ruleA.priority
        const priorityB = ruleB.priority

        try {
            // Update both rules
            await axios.put(`/api/rules/${ruleA.id}`, { priority: priorityB })
            await axios.put(`/api/rules/${ruleB.id}`, { priority: priorityA })

            setNotification({ type: 'success', message: "Priority updated" })
            setRefreshTrigger(prev => prev + 1)
        } catch (err) {
            console.error("Error updating priority", err)
            setNotification({ type: 'error', message: "Failed to update priority" })
        }
    }

    const getTargetDisplay = (rule) => {
        if (rule.target_account) return `Transfer ↳ ${rule.target_account.name}`
        if (rule.target_label) return `Label: ${rule.target_label.name}`
        if (rule.category) return rule.category.name
        return "Uncategorized"
    }

    return (
        <div className="container animate-fade-in">
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <Link to="/transactions" className="btn-icon" style={{ padding: '0.5rem' }}>
                    <ArrowLeft size={20} />
                </Link>
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0 }}>Categorization Rules</h1>
                    <p className="text-muted">Rules are applied in order. Use the arrows to change priority.</p>
                </div>
            </div>

            <div className="glass-card">
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <div className="spinner"></div>
                    </div>
                ) : rules.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <Tag size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: '1rem' }} />
                        <h3>No rules defined</h3>
                        <p className="text-muted">Create rules from the Transactions page using the 'Quick Categorize' tool.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '1rem', width: '80px' }}>Priority</th>
                                    <th style={{ textAlign: 'left', padding: '1rem' }}>Pattern</th>
                                    <th style={{ textAlign: 'left', padding: '1rem' }}>Target</th>
                                    <th style={{ textAlign: 'right', padding: '1rem', width: '120px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rules.map((rule, index) => (
                                    <tr key={rule.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                                                <button
                                                    onClick={() => moveRule(index, -1)}
                                                    disabled={index === 0}
                                                    className="btn-icon-small"
                                                    style={{ opacity: index === 0 ? 0.2 : 1 }}
                                                >
                                                    <ArrowUp size={14} />
                                                </button>
                                                <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{index + 1}</span>
                                                <button
                                                    onClick={() => moveRule(index, 1)}
                                                    disabled={index === rules.length - 1}
                                                    className="btn-icon-small"
                                                    style={{ opacity: index === rules.length - 1 ? 0.2 : 1 }}
                                                >
                                                    <ArrowDown size={14} />
                                                </button>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Zap size={14} style={{ color: 'var(--warning)' }} />
                                                <code style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                                                    {rule.pattern}
                                                </code>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                padding: '0.25rem 0.75rem',
                                                background: rule.target_account ? 'rgba(34, 197, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                                color: rule.target_account ? 'var(--success)' : 'var(--primary-light)',
                                                borderRadius: '2rem',
                                                fontSize: '0.85rem',
                                                fontWeight: 600
                                            }}>
                                                {getTargetDisplay(rule)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleDelete(rule.id)}
                                                className="btn-icon"
                                                style={{ color: 'var(--danger)', opacity: 0.6 }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                                onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="glass-card" style={{ marginTop: '2rem', padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <Info size={20} style={{ color: 'var(--primary)', marginTop: '0.2rem' }} />
                <div>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>How rules work</h4>
                    <p className="text-muted small" style={{ margin: 0 }}>
                        When a transaction is imported or re-categorized, the system checks it against these patterns starting from the top.
                        The first rule that matches will be applied. Move more specific rules (like specific transfers) to the top to ensure they take precedence over general category rules.
                    </p>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .btn-icon-small {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    border-radius: 4px;
                    padding: 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-icon-small:hover:not(:disabled) {
                    background: var(--primary);
                    border-color: var(--primary);
                }
                .btn-icon-small:disabled {
                    cursor: not-allowed;
                }
            `}} />
        </div>
    )
}

export default Rules
