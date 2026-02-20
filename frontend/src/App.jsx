import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { LayoutDashboard, Receipt, Settings, Upload, Wallet, Tag, Database } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import MapperManagement from './pages/MapperManagement'
import AccountManagement from './pages/AccountManagement'
import Rules from './pages/Rules'
import DatabaseSettings from './pages/DatabaseSettings'
import ImportModal from './components/ImportModal'

function App() {
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [isLive, setIsLive] = useState(false)
    const [currentDb, setCurrentDb] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            try {
                const apiRes = await axios.get('/api/')
                setIsLive(true)

                const dbRes = await axios.get('/api/databases/')
                setCurrentDb(dbRes.data.current)
            } catch (err) {
                setIsLive(false)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 10000) // Check every 10s
        return () => clearInterval(interval)
    }, [])

    const handleRefresh = () => setRefreshTrigger(prev => prev + 1)

    return (
        <BrowserRouter>
            <div className="app">
                <nav className="nav">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div className="logo">siexan</div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isLive ? 'var(--success)' : 'var(--danger)',
                            background: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '1rem',
                            border: `1px solid ${isLive ? 'var(--success)' : 'var(--danger)'}`,
                            transition: 'all 0.3s ease'
                        }}>
                            <div style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: isLive ? 'var(--success)' : 'var(--danger)',
                                boxShadow: isLive ? '0 0 8px var(--success)' : 'none'
                            }} />
                            {isLive ? 'LIVE' : 'OFFLINE'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                        <NavLink
                            to="/dashboard"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            style={({ isActive }) => ({
                                background: 'none',
                                border: 'none',
                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 600,
                                textDecoration: 'none'
                            })}
                        >
                            <LayoutDashboard size={18} /> Dashboard
                        </NavLink>
                        <NavLink
                            to="/transactions"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            style={({ isActive }) => ({
                                background: 'none',
                                border: 'none',
                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 600,
                                textDecoration: 'none'
                            })}
                        >
                            <Receipt size={18} /> Transactions
                        </NavLink>
                        <NavLink
                            to="/accounts"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            style={({ isActive }) => ({
                                background: 'none',
                                border: 'none',
                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 600,
                                textDecoration: 'none'
                            })}
                        >
                            <Wallet size={18} /> Accounts
                        </NavLink>
                        <NavLink
                            to="/rules"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            style={({ isActive }) => ({
                                background: 'none',
                                border: 'none',
                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 600,
                                textDecoration: 'none'
                            })}
                        >
                            <Tag size={18} /> Rules
                        </NavLink>
                        <NavLink
                            to="/mapper"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            style={({ isActive }) => ({
                                background: 'none',
                                border: 'none',
                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 600,
                                textDecoration: 'none'
                            })}
                        >
                            <Settings size={18} /> Mappers
                        </NavLink>
                        <NavLink
                            to="/db"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            style={({ isActive }) => ({
                                background: 'none',
                                border: 'none',
                                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 600,
                                textDecoration: 'none'
                            })}
                        >
                            <Database size={18} /> DB
                        </NavLink>
                    </div>
                    <button
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        onClick={() => setIsImportOpen(true)}
                    >
                        <Upload size={18} /> Import CSV
                    </button>
                </nav>

                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '0.4rem 2rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Database size={14} style={{ opacity: 0.7 }} />
                        <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>Active Database:</span>
                        <span style={{ fontFamily: 'monospace' }}>{currentDb || 'None'}</span>
                    </div>
                    <div>
                        Build: <span style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev'}</span>
                        <span style={{ margin: '0 0.5rem', opacity: 0.3 }}>|</span>
                        {typeof __BUILD_TIME__ !== 'undefined' ? new Date(__BUILD_TIME__).toLocaleString() : 'recently'}
                    </div>
                </div>

                <main className="container">
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard refreshTrigger={refreshTrigger} />} />
                        <Route path="/transactions" element={<Transactions refreshTrigger={refreshTrigger} />} />
                        <Route path="/accounts" element={<AccountManagement refreshTrigger={refreshTrigger} />} />
                        <Route path="/mapper" element={<MapperManagement />} />
                        <Route path="/rules" element={<Rules />} />
                        <Route path="/db" element={<DatabaseSettings />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </main>

                {isImportOpen && (
                    <ImportModal
                        onClose={() => setIsImportOpen(false)}
                        onComplete={handleRefresh}
                    />
                )}
            </div>
        </BrowserRouter>
    )
}

export default App
