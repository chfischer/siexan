import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { X, Upload, CheckCircle } from 'lucide-react'

function ImportModal({ onClose, onComplete }) {
    const [profiles, setProfiles] = useState([])
    const [accounts, setAccounts] = useState([])
    const [selectedProfile, setSelectedProfile] = useState('')
    const [selectedAccount, setSelectedAccount] = useState('')
    const [file, setFile] = useState(null)
    const [status, setStatus] = useState('idle') // idle, uploading, success, error
    const [message, setMessage] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [pRes, aRes] = await Promise.all([
                    axios.get('/api/profiles/'),
                    axios.get('/api/accounts/')
                ])
                setProfiles(pRes.data)
                setAccounts(aRes.data)
                if (pRes.data.length > 0) setSelectedProfile(pRes.data[0].id)
                if (aRes.data.length > 0) setSelectedAccount(aRes.data[0].id)
            } catch (err) {
                console.error("Error fetching setup data", err)
            }
        }
        fetchData()
    }, [])

    const handleUpload = async () => {
        if (!file || !selectedProfile || !selectedAccount) {
            alert("Please select a file, mapper, and account")
            return
        }

        setStatus('uploading')
        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await axios.post(`/api/upload-csv/?account_id=${selectedAccount}&profile_id=${selectedProfile}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            setStatus('success')
            setMessage(res.data.message)
            setTimeout(() => {
                onComplete()
                onClose()
            }, 2000)
        } catch (err) {
            setStatus('error')
            setMessage(err.response?.data?.detail || "Upload failed")
        }
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="glass-card" style={{ width: '400px', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                    <X size={24} />
                </button>

                <h2 style={{ marginBottom: '1.5rem' }}>Import Transactions</h2>

                {status === 'success' ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <CheckCircle size={48} color="var(--success)" style={{ marginBottom: '1rem' }} />
                        <p>{message}</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Select Account</label>
                            <select
                                value={selectedAccount}
                                onChange={e => setSelectedAccount(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                            >
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Select Mapper</label>
                            <select
                                value={selectedProfile}
                                onChange={e => setSelectedProfile(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                            >
                                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div style={{
                            border: '2px dashed var(--border)',
                            borderRadius: '0.5rem',
                            padding: '2rem',
                            textAlign: 'center',
                            cursor: 'pointer'
                        }} onClick={() => document.getElementById('csv-file').click()}>
                            <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                            <p style={{ fontSize: '0.875rem' }}>{file ? file.name : "Click to select CSV file"}</p>
                            <input
                                id="csv-file"
                                type="file"
                                accept=".csv"
                                hidden
                                onChange={e => setFile(e.target.files[0])}
                            />
                        </div>

                        {status === 'error' && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{message}</p>}

                        <button
                            className="btn-primary"
                            onClick={handleUpload}
                            disabled={status === 'uploading'}
                            style={{ width: '100%', marginTop: '0.5rem' }}
                        >
                            {status === 'uploading' ? "Processing..." : "Start Import"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ImportModal
