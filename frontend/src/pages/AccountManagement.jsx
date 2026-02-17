import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Wallet, Trash2 } from 'lucide-react'

function AccountManagement({ refreshTrigger }) {
    const [accounts, setAccounts] = useState([])
    const [newName, setNewName] = useState('')
    const [newType, setNewType] = useState('Checking')

    useEffect(() => {
        fetchAccounts()
    }, [refreshTrigger])

    const fetchAccounts = async () => {
        try {
            const res = await axios.get('/api/accounts/')
            setAccounts(res.data)
        } catch (err) {
            console.error("Error fetching accounts", err)
        }
    }

    const handleCreate = async () => {
        if (!newName) return
        try {
            await axios.post('/api/accounts/', { name: newName, type: newType })
            setNewName('')
            fetchAccounts()
        } catch (err) {
            alert("Error creating account")
        }
    }

    const handleSeed = async () => {
        try {
            await axios.post('/api/seed/')
            fetchAccounts()
            alert("Database seeded with sample accounts and categories!")
        } catch (err) {
            alert("Error seeding database")
        }
    }

    return (
        <div>
            <h1 style={{ marginBottom: '2rem' }}>Account Management</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="glass-card">
                    <h2 style={{ marginBottom: '1.5rem' }}>Add New Account</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input
                            type="text"
                            placeholder="Account Name (e.g. My Savings)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                        />
                        <select
                            value={newType}
                            onChange={e => setNewType(e.target.value)}
                            style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                        >
                            <option value="Checking">Checking</option>
                            <option value="Savings">Savings</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Investment">Investment</option>
                        </select>
                        <button className="btn-primary" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <Plus size={18} /> Create Account
                        </button>
                    </div>

                    <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>Need sample data?</p>
                        <button onClick={handleSeed} style={{ background: 'none', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: '0.5rem', width: '100%', fontWeight: 600 }}>
                            Seed with Defaults
                        </button>
                    </div>
                </div>

                <div className="glass-card">
                    <h2 style={{ marginBottom: '1.5rem' }}>Existing Accounts</h2>
                    {accounts.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No accounts found.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {accounts.map(acc => (
                                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <Wallet size={20} color="var(--primary)" />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{acc.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{acc.type}</div>
                                        </div>
                                    </div>
                                    <button style={{ background: 'none', border: 'none', color: 'var(--danger)' }}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default AccountManagement
