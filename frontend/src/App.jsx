import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { LayoutDashboard, Receipt, Settings, Upload, Wallet, Tag, Database } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import MapperManagement from './pages/MapperManagement'
import AccountManagement from './pages/AccountManagement'
import CategorizationRules from './pages/CategorizationRules'
import DatabaseSettings from './pages/DatabaseSettings'
import ImportModal from './components/ImportModal'

function App() {
    const [activeTab, setActiveTab] = useState('dashboard')
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [isLive, setIsLive] = useState(false)

    useEffect(() => {
        const checkConnection = async () => {
            try {
                await axios.get('/api/')
                setIsLive(true)
            } catch (err) {
                setIsLive(false)
            }
        }

        checkConnection()
        const interval = setInterval(checkConnection, 10000) // Check every 10s
        return () => clearInterval(interval)
    }, [])

    const handleRefresh = () => setRefreshTrigger(prev => prev + 1)

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <Dashboard refreshTrigger={refreshTrigger} />
            case 'transactions': return <Transactions refreshTrigger={refreshTrigger} />
            case 'accounts': return <AccountManagement refreshTrigger={refreshTrigger} />
            case 'mapper': return <MapperManagement />
            case 'rules': return <CategorizationRules refreshTrigger={refreshTrigger} />
            case 'db': return <DatabaseSettings />
            default: return <Dashboard refreshTrigger={refreshTrigger} />
        }
    }

    return (
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
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'dashboard' ? 'var(--primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600
                        }}
                    >
                        <LayoutDashboard size={18} /> Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('transactions')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'transactions' ? 'var(--primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600
                        }}
                    >
                        <Receipt size={18} /> Transactions
                    </button>
                    <button
                        onClick={() => setActiveTab('accounts')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'accounts' ? 'var(--primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600
                        }}
                    >
                        <Wallet size={18} /> Accounts
                    </button>
                    <button
                        onClick={() => setActiveTab('rules')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'rules' ? 'var(--primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600
                        }}
                    >
                        <Tag size={18} /> Rules
                    </button>
                    <button
                        onClick={() => setActiveTab('mapper')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'mapper' ? 'var(--primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600
                        }}
                    >
                        <Settings size={18} /> Mappers
                    </button>
                    <button
                        onClick={() => setActiveTab('db')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: activeTab === 'db' ? 'var(--primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 600
                        }}
                    >
                        <Database size={18} /> DB
                    </button>
                </div>
                <button
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => setIsImportOpen(true)}
                >
                    <Upload size={18} /> Import CSV
                </button>
            </nav>

            <main className="container">
                {renderContent()}
            </main>

            {isImportOpen && (
                <ImportModal
                    onClose={() => setIsImportOpen(false)}
                    onComplete={handleRefresh}
                />
            )}
        </div>
    )
}

export default App
