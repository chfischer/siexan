import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Folder, File, ChevronRight, Home, ArrowLeft, X, RefreshCw } from 'lucide-react'

function FileExplorer({ onClose, onSelect }) {
    const [currentPath, setCurrentPath] = useState('')
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const fetchPath = async (path = '') => {
        setLoading(true)
        setError('')
        try {
            const url = `/api/filesystem/list${path ? `?path=${encodeURIComponent(path)}` : ''}`
            const res = await axios.get(url)
            setItems(res.data.items)
            setCurrentPath(res.data.path)
            setLoading(false)
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to load directory')
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPath()
    }, [])

    const handleNavigate = (path) => {
        fetchPath(path)
    }

    const handleGoBack = () => {
        const parts = currentPath.split('/').filter(Boolean)
        if (parts.length > 0) {
            parts.pop()
            const parent = '/' + parts.join('/')
            fetchPath(parent)
        } else if (currentPath !== '/') {
            fetchPath('/')
        }
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="glass-card" style={{ width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                    <X size={24} />
                </button>

                <h2 style={{ marginBottom: '1rem' }}>Select Database File</h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '1rem', overflowX: 'auto', whiteSpace: 'nowrap', padding: '0.5rem 0' }}>
                    <button
                        onClick={() => fetchPath('')}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        <Home size={18} />
                    </button>
                    <ChevronRight size={14} color="var(--text-muted)" />
                    <button
                        onClick={() => fetchPath('/')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                        /
                    </button>
                    {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
                        <React.Fragment key={i}>
                            <ChevronRight size={14} color="var(--text-muted)" />
                            <button
                                onClick={() => handleNavigate('/' + arr.slice(0, i + 1).join('/'))}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer' }}
                            >
                                {part}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', minHeight: '300px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                            <RefreshCw className="spin" size={32} color="var(--primary)" />
                        </div>
                    ) : error ? (
                        <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '2rem' }}>{error}</div>
                    ) : (
                        <>
                            {currentPath !== '/' && (
                                <div
                                    className="explorer-item"
                                    onClick={handleGoBack}
                                    style={{ padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                                >
                                    <ArrowLeft size={18} color="var(--text-muted)" />
                                    <span>..</span>
                                </div>
                            )}
                            {items.map(item => (
                                <div
                                    key={item.path}
                                    className="explorer-item"
                                    onClick={() => item.is_dir ? handleNavigate(item.path) : onSelect(item.path)}
                                    style={{
                                        padding: '0.75rem',
                                        borderRadius: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    {item.is_dir ? <Folder size={18} color="var(--primary)" /> : <File size={18} color="var(--text-muted)" />}
                                    <span style={{ fontSize: '0.9rem' }}>{item.name}</span>
                                </div>
                            ))}
                            {items.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>This folder is empty or contains no .db files.</div>}
                        </>
                    )}
                </div>

                <style>{`
                    .explorer-item {
                        transition: all 0.2s ease;
                    }
                    .explorer-item:hover {
                        background: rgba(99, 102, 241, 0.1) !important;
                        padding-left: 1rem !important;
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
        </div>
    )
}

export default FileExplorer
