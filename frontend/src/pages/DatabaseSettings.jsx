import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Database, Plus, Check, RefreshCw, AlertCircle } from 'lucide-react'

function DatabaseSettings() {
    const [databases, setDatabases] = useState([])
    const [currentDb, setCurrentDb] = useState('')
    const [newDbName, setNewDbName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [reloading, setReloading] = useState(false)

    const fetchDatabases = async () => {
        try {
            const res = await axios.get('/api/databases/')
            setDatabases(res.data.databases)
            setCurrentDb(res.data.current)
        } catch (err) {
            setError('Failed to fetch databases')
        }
    }

    useEffect(() => {
        fetchDatabases()
    }, [])

    const handleSelect = async (name) => {
        if (name === currentDb) return
        setLoading(true)
        try {
            await axios.post(`/api/databases/select?db_name=${name}`)
            setReloading(true)
            // Wait for backend to reload
            setTimeout(() => {
                window.location.reload()
            }, 2000)
        } catch (err) {
            setError('Failed to switch database')
            setLoading(false)
        }
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!newDbName) return
        setLoading(true)
        try {
            await axios.post(`/api/databases/create?db_name=${newDbName}`)
            setReloading(true)
            setTimeout(() => {
                window.location.reload()
            }, 2000)
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create database')
            setLoading(false)
        }
    }

    if (reloading) {
        return (
            <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
                <RefreshCw className="spin" size={48} color="var(--primary)" style={{ marginBottom: '1.5rem' }} />
                <h2>Switching Database...</h2>
                <p className="text-muted">The application is reloading with the new database.</p>
            </div>
        )
    }

    return (
        <div className="database-settings">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Database Settings</h1>
                    <p className="text-muted">Manage and switch between different SQLite database files.</p>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="glass-card">
                    <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Database size={20} /> Available Databases
                    </h2>

                    {error && (
                        <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {databases.map(db => (
                            <div
                                key={db}
                                className={`db-item ${db === currentDb ? 'active' : ''}`}
                                onClick={() => handleSelect(db)}
                                style={{
                                    padding: '1rem',
                                    borderRadius: '0.75rem',
                                    background: db === currentDb ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${db === currentDb ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                                    cursor: db === currentDb ? 'default' : 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <Database size={18} color={db === currentDb ? 'var(--primary)' : 'var(--text-muted)'} />
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{db}</div>
                                        {db === currentDb && <div style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Currently Active</div>}
                                    </div>
                                </div>
                                {db === currentDb && <Check size={18} color="var(--primary)" />}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-card">
                    <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Plus size={20} /> Create New Database
                    </h2>
                    <form onSubmit={handleCreate}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Database Name</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. household_2024.db"
                                value={newDbName}
                                onChange={(e) => setNewDbName(e.target.value)}
                                style={{ width: '100%' }}
                            />
                            <p className="x-small text-muted" style={{ marginTop: '0.5rem' }}>
                                A new database will be created and selected. You will need to re-import your data.
                            </p>
                        </div>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading || !newDbName}
                            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                        >
                            {loading ? <RefreshCw className="spin" size={18} /> : <Plus size={18} />}
                            Create & Switch
                        </button>
                    </form>
                </div>
            </div>

            <style>{`
                .db-item:not(.active):hover {
                    background: rgba(255,255,255,0.06) !important;
                    border-color: rgba(255,255,255,0.2) !important;
                    transform: translateX(4px);
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div>
    )
}

export default DatabaseSettings
