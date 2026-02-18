import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Plus, Download, Trash2, Save, FileUp, ListRestart } from 'lucide-react'

function MapperManagement() {
    const [profiles, setProfiles] = useState([])
    const [headers, setHeaders] = useState([])
    const [previewLines, setPreviewLines] = useState([])
    const [rawContent, setRawContent] = useState('')
    const [isDualAmount, setIsDualAmount] = useState(false)
    const [descriptionFields, setDescriptionFields] = useState([''])
    const [newProfile, setNewProfile] = useState({
        name: '',
        column_mapping: {
            date: '', amount: '', credit: '', debit: '', description: [],
            amount_type: '', credit_indicators: 'C,CR,CREDIT', debit_indicators: 'D,DR,DEBIT',
            invert_amount: false
        },
        date_format: '%Y-%m-%d',
        delimiter: ',',
        header_row: 0
    })

    useEffect(() => {
        fetchProfiles()
    }, [])

    const fetchProfiles = async () => {
        try {
            const res = await axios.get('/api/profiles/')
            setProfiles(res.data)
        } catch (err) {
            console.error("Error fetching profiles", err)
        }
    }

    const parseHeaders = useCallback((content, delimiter, headerRow) => {
        if (!content) return
        const lines = content.split('\n')
        setPreviewLines(lines.slice(0, 10))

        const headerLine = lines[headerRow]
        if (headerLine) {
            const detectedHeaders = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''))
            setHeaders(detectedHeaders)
        }
    }, [])

    useEffect(() => {
        if (rawContent) {
            parseHeaders(rawContent, newProfile.delimiter, newProfile.header_row)
        }
    }, [newProfile.delimiter, newProfile.header_row, rawContent, parseHeaders])

    const handleFileLoad = (e) => {
        const file = e.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const content = event.target.result
            setRawContent(content)
        }
        reader.readAsText(file)
    }

    const handleSave = async () => {
        const finalMapping = { ...newProfile.column_mapping }
        finalMapping.description = descriptionFields.filter(f => f !== '')

        if (!newProfile.name || !finalMapping.date || finalMapping.description.length === 0) {
            alert("Please fill in Mapper Name, Date, and at least one Description field")
            return
        }

        if (isDualAmount) {
            if (!finalMapping.credit && !finalMapping.debit) {
                alert("Please select at least one of Credit or Debit columns")
                return
            }
        } else if (!finalMapping.amount) {
            alert("Please select the Amount column")
            return
        }

        try {
            await axios.post('/api/profiles/', { ...newProfile, column_mapping: finalMapping })
            setNewProfile({
                name: '',
                column_mapping: {
                    date: '', amount: '', credit: '', debit: '', description: [],
                    amount_type: '', credit_indicators: 'C,CR,CREDIT', debit_indicators: 'D,DR,DEBIT',
                    invert_amount: false
                },
                date_format: '%Y-%m-%d',
                delimiter: ',',
                header_row: 0
            })
            setHeaders([])
            setPreviewLines([])
            setRawContent('')
            setDescriptionFields([''])
            setIsDualAmount(false)
            fetchProfiles()
        } catch (err) {
            alert("Error saving profile")
        }
    }

    const exportProfile = (p) => {
        const { id, ...dataToExport } = p
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${p.name}_mapper.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    const exportAllProfiles = async () => {
        try {
            const res = await axios.get('/api/profiles/export/')
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `all_mappers_backup.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        } catch (err) {
            alert("Failed to export mappers")
        }
    }

    const importProfiles = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result)
                const res = await axios.post('/api/profiles/import/', Array.isArray(data) ? data : [data])
                alert(res.data.message)
                fetchProfiles()
            } catch (err) {
                alert("Error importing mappers: " + (err.response?.data?.detail || "Invalid JSON"))
            }
        }
        reader.readAsText(file)
        e.target.value = null // Reset input
    }

    const addDescriptionField = () => setDescriptionFields([...descriptionFields, ''])
    const removeDescriptionField = (idx) => {
        const newFields = [...descriptionFields]
        newFields.splice(idx, 1)
        setDescriptionFields(newFields)
    }

    return (
        <div style={{ paddingBottom: '4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>CSV Mapper Management</h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <label className="btn-primary" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <FileUp size={18} /> Import JSON
                        <input type="file" accept=".json" onChange={importProfiles} style={{ display: 'none' }} />
                    </label>
                    <button className="btn-primary" onClick={exportAllProfiles} style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Download size={18} /> Export All
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '2rem' }}>
                <div className="glass-card">
                    <h2 style={{ marginBottom: '1.5rem' }}>Create New Mapper</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Mapper Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Chase Credit Card"
                                value={newProfile.name}
                                onChange={e => setNewProfile({ ...newProfile, name: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                            />
                        </div>

                        <div style={{ border: '1px dashed var(--border)', padding: '1.5rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Load Sample CSV</p>
                                <input type="file" accept=".csv" onChange={handleFileLoad} style={{ fontSize: '0.875rem' }} />
                            </div>

                            {previewLines.length > 0 && (
                                <div style={{ marginTop: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Delimiter</label>
                                            <select
                                                value={newProfile.delimiter}
                                                onChange={e => setNewProfile({ ...newProfile, delimiter: e.target.value })}
                                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                                            >
                                                <option value=",">Comma (,)</option>
                                                <option value=";">Semicolon (;)</option>
                                                <option value="\t">Tab</option>
                                                <option value="|">Pipe (|)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Header Row Index</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={newProfile.header_row}
                                                onChange={e => setNewProfile({ ...newProfile, header_row: parseInt(e.target.value) || 0 })}
                                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ background: 'black', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.75rem', overflowX: 'auto', border: '1px solid var(--border)' }}>
                                        <p style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 600 }}>File Preview (First 10 lines)</p>
                                        {previewLines.map((line, idx) => (
                                            <div key={idx} style={{
                                                whiteSpace: 'nowrap',
                                                color: idx === newProfile.header_row ? 'var(--success)' : 'var(--text-muted)',
                                                background: idx === newProfile.header_row ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                                padding: '2px 4px'
                                            }}>
                                                <span style={{ width: '20px', display: 'inline-block', opacity: 0.5 }}>{idx}</span> {line}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Date Field</label>
                                <select
                                    value={newProfile.column_mapping.date}
                                    onChange={e => setNewProfile({ ...newProfile, column_mapping: { ...newProfile.column_mapping, date: e.target.value } })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                                >
                                    <option value="">Select Column</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                                    Amount Mode
                                    <span style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => setIsDualAmount(!isDualAmount)}>
                                        [Switch to {isDualAmount ? 'Single' : 'Credit/Debit'}]
                                    </span>
                                </label>
                                {!isDualAmount ? (
                                    <select
                                        value={newProfile.column_mapping.amount}
                                        onChange={e => setNewProfile({ ...newProfile, column_mapping: { ...newProfile.column_mapping, amount: e.target.value, credit: '', debit: '' } })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                                    >
                                        <option value="">Select Amount Column</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <select
                                            value={newProfile.column_mapping.credit}
                                            onChange={e => setNewProfile({ ...newProfile, column_mapping: { ...newProfile.column_mapping, credit: e.target.value, amount: '' } })}
                                            style={{ width: '50%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                                        >
                                            <option value="">Credit</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                        <select
                                            value={newProfile.column_mapping.debit}
                                            onChange={e => setNewProfile({ ...newProfile, column_mapping: { ...newProfile.column_mapping, debit: e.target.value, amount: '' } })}
                                            style={{ width: '50%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                                        >
                                            <option value="">Debit</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Amount Options */}
                        {(newProfile.column_mapping.amount || isDualAmount) && (
                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={newProfile.column_mapping.invert_amount}
                                            onChange={e => setNewProfile({
                                                ...newProfile,
                                                column_mapping: { ...newProfile.column_mapping, invert_amount: e.target.checked }
                                            })}
                                        />
                                        Invert Amount (Flip signs)
                                    </label>
                                </div>
                                {!isDualAmount && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>Indicator/Type Column (Optional)</label>
                                            <select
                                                value={newProfile.column_mapping.amount_type}
                                                onChange={e => setNewProfile({
                                                    ...newProfile,
                                                    column_mapping: { ...newProfile.column_mapping, amount_type: e.target.value }
                                                })}
                                                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                                            >
                                                <option value="">No Type Column</option>
                                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </div>
                                        {newProfile.column_mapping.amount_type && (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>Credit Symbols</label>
                                                    <input
                                                        type="text"
                                                        placeholder="C,CR,+"
                                                        value={newProfile.column_mapping.credit_indicators}
                                                        onChange={e => setNewProfile({
                                                            ...newProfile,
                                                            column_mapping: { ...newProfile.column_mapping, credit_indicators: e.target.value }
                                                        })}
                                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>Debit Symbols</label>
                                                    <input
                                                        type="text"
                                                        placeholder="D,DR,-"
                                                        value={newProfile.column_mapping.debit_indicators}
                                                        onChange={e => setNewProfile({
                                                            ...newProfile,
                                                            column_mapping: { ...newProfile.column_mapping, debit_indicators: e.target.value }
                                                        })}
                                                        style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    {!isDualAmount
                                        ? "Indicator column overrides the sign of the amount based on the symbols provided (comma-separated)."
                                        : "In dual mode, the system calculates [Credit] - [Debit] using magnitudes. Use 'Invert' if your mapping results in flipped signs."}
                                </p>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Description Fields (Concatenated)</label>
                            {descriptionFields.map((field, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <select
                                        value={field}
                                        onChange={e => {
                                            const newFields = [...descriptionFields]
                                            newFields[idx] = e.target.value
                                            setDescriptionFields(newFields)
                                        }}
                                        style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white' }}
                                    >
                                        <option value="">Select Column</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                    {descriptionFields.length > 1 && (
                                        <button onClick={() => removeDescriptionField(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)' }}><Trash2 size={18} /></button>
                                    )}
                                </div>
                            ))}
                            <button onClick={addDescriptionField} style={{ background: 'none', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.75rem', marginTop: '0.5rem', width: '100%' }}>
                                + Add another field to description
                            </button>
                        </div>

                        <button className="btn-primary" onClick={handleSave} style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}>
                            <Save size={18} /> Save Mapper Configuration
                        </button>
                    </div>
                </div>

                <div className="glass-card">
                    <h2 style={{ marginBottom: '1.5rem' }}>Saved Configurations</h2>
                    {profiles.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No mappers saved yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {profiles.map(p => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{p.name}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            CSV: {p.delimiter === ',' ? 'Comma' : p.delimiter} | Header Row: {p.header_row}
                                        </span>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                            {p.column_mapping.date} → Date, {p.column_mapping.amount} → Amount
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button onClick={() => exportProfile(p)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Export JSON"><Download size={20} /></button>
                                        <button
                                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                                            onClick={async () => {
                                                if (window.confirm("Delete this mapper?")) {
                                                    await axios.delete(`/api/profiles/${p.id}`)
                                                    fetchProfiles()
                                                }
                                            }}
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default MapperManagement
