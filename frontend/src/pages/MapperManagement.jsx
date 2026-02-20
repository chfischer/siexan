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
    const [accounts, setAccounts] = useState([])
    const [editModeId, setEditModeId] = useState(null)
    const [newProfile, setNewProfile] = useState({
        name: '',
        column_mapping: {
            date: '', amount: '', credit: '', debit: '', description: [],
            amount_type: '', credit_indicators: 'C,CR,CREDIT', debit_indicators: 'D,DR,DEBIT',
            invert_amount: false,
            account: '', account_mapping: {}
        },
        date_format: '%Y-%m-%d',
        delimiter: ',',
        header_row: 0
    })

    useEffect(() => {
        fetchProfiles()
        fetchAccounts()
    }, [])

    const fetchAccounts = async () => {
        try {
            const res = await axios.get('/api/accounts/')
            setAccounts(res.data)
        } catch (err) {
            console.error(err)
        }
    }

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
        setPreviewLines(lines.slice(0, headerRow + 21))

        const headerLine = lines[headerRow]
        if (headerLine) {
            const detectedHeaders = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''))
            setHeaders(detectedHeaders)

            // Auto-detect columns
            let autoDate = ''
            let autoAmount = ''
            const autoDesc = []

            detectedHeaders.forEach((h, idx) => {
                const hl = h.toLowerCase()

                // Date by name
                if (!autoDate && (hl === 'date' || hl.includes('date'))) {
                    autoDate = h
                }

                // Description by name
                if (hl.includes('description') || hl.includes('text') || hl.includes('comment')) {
                    autoDesc.push(h)
                }

                // Amount by name
                if (!autoAmount && (hl === 'amount' || hl.includes('amount') || hl === 'buchung' || hl === 'betrag' || hl === 'value')) {
                    autoAmount = h
                }
            })

            // Fallback for Date and Amount: first data line
            if (!autoDate || !autoAmount) {
                const firstDataLine = lines[headerRow + 1]
                if (firstDataLine) {
                    const rowCols = firstDataLine.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''))
                    for (let i = 0; i < rowCols.length; i++) {
                        const val = rowCols[i]
                        // Date fallback
                        if (!autoDate && val && !/^\d+$/.test(val) && /^\d{1,4}[\.\-\/]\d{1,2}[\.\-\/]\d{1,4}(?:\s+\d{1,2}:\d{2}(:\d{2})?)?$/.test(val)) {
                            autoDate = detectedHeaders[i]
                        }
                        // Amount fallback (looks like a clean positive/negative float)
                        if (!autoAmount && val && /^-?\d+([.,]\d{1,2})?$/.test(val) && val !== '0' && val !== '0.00' && val !== '0,00' && val.length < 15) {
                            autoAmount = detectedHeaders[i]
                        }
                    }
                }
            }

            // Update states if anything was found
            setNewProfile(prev => ({
                ...prev,
                column_mapping: {
                    ...prev.column_mapping,
                    date: autoDate || '',
                    amount: autoAmount || ''
                }
            }))
            if (autoDesc.length > 0) {
                setDescriptionFields(autoDesc)
            } else {
                setDescriptionFields([''])
            }
        }
    }, [])

    useEffect(() => {
        if (rawContent) {
            parseHeaders(rawContent, newProfile.delimiter, newProfile.header_row)
        }
    }, [newProfile.delimiter, newProfile.header_row, rawContent, parseHeaders])

    // Auto-extract unique account strings when account column is selected
    useEffect(() => {
        if (rawContent && newProfile.column_mapping.account && headers.length > 0) {
            const accIdx = headers.indexOf(newProfile.column_mapping.account)
            if (accIdx === -1) return

            const lines = rawContent.split('\n')
            const uniqueAccounts = new Set()

            for (let i = newProfile.header_row + 1; i < lines.length; i++) {
                const line = lines[i]
                if (!line.trim()) continue
                // Simple split handling based on delimiter pattern used in header
                const cols = line.split(newProfile.delimiter)
                if (cols.length > accIdx) {
                    const val = cols[accIdx].trim().replace(/^"|"$/g, '')
                    if (val) uniqueAccounts.add(val)
                }
            }

            if (uniqueAccounts.size > 0) {
                setNewProfile(prev => {
                    const currentMapping = prev.column_mapping.account_mapping || {}
                    const newMapping = { ...currentMapping }
                    let changed = false

                    uniqueAccounts.forEach(acc => {
                        if (newMapping[acc] === undefined) {
                            newMapping[acc] = ''
                            changed = true
                        }
                    })

                    if (changed) {
                        return {
                            ...prev,
                            column_mapping: {
                                ...prev.column_mapping,
                                account_mapping: newMapping
                            }
                        }
                    }
                    return prev
                })
            }
        }
    }, [newProfile.column_mapping.account, rawContent, headers, newProfile.delimiter, newProfile.header_row])

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
            if (editModeId) {
                await axios.put(`/api/profiles/${editModeId}`, { ...newProfile, column_mapping: finalMapping })
            } else {
                await axios.post('/api/profiles/', { ...newProfile, column_mapping: finalMapping })
            }

            cancelEditMode()
            fetchProfiles()
        } catch (err) {
            alert(`Error saving profile: ${err.message}`)
        }
    }

    const loadProfileForEdit = (p) => {
        setEditModeId(p.id)
        setNewProfile({ ...p })

        // Restore complex nested UI states
        const mapping = p.column_mapping || {}

        let desc = mapping.description
        if (!desc) desc = ['']
        else if (typeof desc === 'string') desc = [desc]
        setDescriptionFields(desc.length > 0 ? desc : [''])

        setIsDualAmount(!!(mapping.credit || mapping.debit))
    }

    const cancelEditMode = () => {
        setEditModeId(null)
        setNewProfile({
            name: '',
            column_mapping: {
                date: '', amount: '', credit: '', debit: '', description: [],
                amount_type: '', credit_indicators: 'C,CR,CREDIT', debit_indicators: 'D,DR,DEBIT',
                invert_amount: false,
                account: '', account_mapping: {}
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

    const addAccountMapping = () => {
        setNewProfile({
            ...newProfile,
            column_mapping: {
                ...newProfile.column_mapping,
                account_mapping: {
                    ...newProfile.column_mapping.account_mapping,
                    '': ''
                }
            }
        })
    }

    const updateAccountMappingKey = (oldKey, newKey) => {
        const newMapping = { ...newProfile.column_mapping.account_mapping }
        const val = newMapping[oldKey]
        delete newMapping[oldKey]
        newMapping[newKey] = val || ''
        setNewProfile({ ...newProfile, column_mapping: { ...newProfile.column_mapping, account_mapping: newMapping } })
    }

    const updateAccountMappingValue = (key, val) => {
        const newMapping = { ...newProfile.column_mapping.account_mapping }
        newMapping[key] = val
        setNewProfile({ ...newProfile, column_mapping: { ...newProfile.column_mapping, account_mapping: newMapping } })
    }

    const removeAccountMapping = (key) => {
        const newMapping = { ...newProfile.column_mapping.account_mapping }
        delete newMapping[key]
        setNewProfile({ ...newProfile, column_mapping: { ...newProfile.column_mapping, account_mapping: newMapping } })
    }

    const cleanAmount = (val) => {
        if (!val) return 0;
        let s = val.toString().trim();
        s = s.replace(/[^0-9.,\-()+]/g, '');
        if (!s) return 0;
        if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1);
        if (s.includes(',') && s.includes('.')) {
            if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(/,/g, '.');
            else s = s.replace(/,/g, '');
        } else if (s.includes(',')) {
            if (s.split(',').length === 2 && s.split(',')[1].length === 2) s = s.replace(/,/g, '.');
            else s = s.replace(/,/g, '');
        }
        return parseFloat(s) || 0;
    }

    const getRowAmountValue = (rowCols, headerArray, mapping) => {
        let amount = 0;
        const getColVal = (colName) => {
            if (!colName) return '';
            const idx = headerArray.indexOf(colName);
            return idx !== -1 ? rowCols[idx].replace(/^"|"$/g, '') : '';
        }

        if (mapping.amount) {
            const rawVal = getColVal(mapping.amount);
            amount = cleanAmount(rawVal);

            if (mapping.amount_type) {
                const indicator = getColVal(mapping.amount_type).trim().toUpperCase();
                const credits = (mapping.credit_indicators || '').split(',').map(s => s.trim().toUpperCase());
                const debits = (mapping.debit_indicators || '').split(',').map(s => s.trim().toUpperCase());

                if (debits.includes(indicator)) amount = -Math.abs(amount);
                else if (credits.includes(indicator)) amount = Math.abs(amount);
            }
        } else if (mapping.credit || mapping.debit) {
            const cVal = Math.abs(cleanAmount(getColVal(mapping.credit)));
            const dVal = Math.abs(cleanAmount(getColVal(mapping.debit)));
            amount = cVal - dVal;
        }

        if (mapping.invert_amount) amount = -amount;
        return amount;
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
                                        <p style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 600 }}>File Preview</p>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                                            <thead>
                                                {previewLines.map((line, idx) => {
                                                    if (idx !== newProfile.header_row) return null;
                                                    const cols = line.split(newProfile.delimiter)
                                                    return (
                                                        <tr key={`header-${idx}`} style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', borderBottom: '2px solid rgba(16, 185, 129, 0.5)' }}>
                                                            <th style={{ padding: '8px', width: '30px', opacity: 0.8, borderRight: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>#</th>
                                                            {cols.map((col, cIdx) => (
                                                                <th key={cIdx} style={{ padding: '8px', borderRight: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
                                                                    {col.replace(/^"|"$/g, '')}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    )
                                                })}
                                            </thead>
                                            <tbody>
                                                {previewLines.map((line, idx) => {
                                                    if (idx <= newProfile.header_row || !line.trim()) return null;
                                                    const cols = line.split(newProfile.delimiter)

                                                    const amountVal = getRowAmountValue(cols, headers, newProfile.column_mapping)
                                                    const isPos = amountVal > 0
                                                    const isNeg = amountVal < 0

                                                    return (
                                                        <tr key={`row-${idx}`} style={{
                                                            color: 'var(--text-muted)',
                                                            borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                        }}>
                                                            <td style={{ padding: '4px 8px', width: '30px', opacity: 0.5, borderRight: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>{idx}</td>
                                                            {cols.map((col, cIdx) => {
                                                                const hName = headers[cIdx]
                                                                let cellColor = 'inherit'

                                                                if (hName) {
                                                                    if (hName === newProfile.column_mapping.amount) {
                                                                        if (isPos) cellColor = 'var(--success)'
                                                                        if (isNeg) cellColor = 'var(--danger)'
                                                                    } else if (hName === newProfile.column_mapping.credit && Math.abs(cleanAmount(col)) > 0) {
                                                                        if (newProfile.column_mapping.invert_amount) cellColor = 'var(--danger)'
                                                                        else cellColor = 'var(--success)'
                                                                    } else if (hName === newProfile.column_mapping.debit && Math.abs(cleanAmount(col)) > 0) {
                                                                        if (newProfile.column_mapping.invert_amount) cellColor = 'var(--success)'
                                                                        else cellColor = 'var(--danger)'
                                                                    }
                                                                }

                                                                return (
                                                                    <td key={cIdx} style={{ padding: '4px 8px', borderRight: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap', color: cellColor }}>
                                                                        {col.replace(/^"|"$/g, '')}
                                                                    </td>
                                                                )
                                                            })}
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
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

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Account Field (Multi-Account Imports)</label>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                If your CSV contains transactions for multiple accounts, explicitly map the account column and define string-to-account mappings. Matched transactions will be placed into the specified accounts, overriding your default import selection.
                            </p>
                            <select
                                value={newProfile.column_mapping.account || ''}
                                onChange={e => setNewProfile({ ...newProfile, column_mapping: { ...newProfile.column_mapping, account: e.target.value } })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white', marginBottom: '1rem' }}
                            >
                                <option value="">No Account Column</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>

                            {newProfile.column_mapping.account && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                                    <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>Account String Mappings</label>
                                    {Object.entries(newProfile.column_mapping.account_mapping || {}).map(([key, val], idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <input
                                                type="text"
                                                value={key}
                                                placeholder="String in CSV"
                                                onChange={(e) => updateAccountMappingKey(key, e.target.value)}
                                                style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white', fontSize: '0.875rem' }}
                                            />
                                            <span style={{ display: 'flex', alignItems: 'center', opacity: 0.5 }}>→</span>
                                            <select
                                                value={val}
                                                onChange={(e) => updateAccountMappingValue(key, e.target.value)}
                                                style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'white', fontSize: '0.875rem' }}
                                            >
                                                <option value="">Select Account</option>
                                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                            </select>
                                            <button onClick={() => removeAccountMapping(key)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                        </div>
                                    ))}
                                    <button onClick={addAccountMapping} style={{ background: 'none', border: '1px dashed var(--primary)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.75rem', marginTop: '0.5rem', width: '100%', cursor: 'pointer' }}>
                                        + Add Mapping Rule
                                    </button>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button className="btn-primary" onClick={handleSave} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}>
                                <Save size={18} /> {editModeId ? 'Update Mapper' : 'Save Mapper'}
                            </button>

                            {editModeId && (
                                <button className="btn-secondary" onClick={cancelEditMode} style={{ width: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', border: '1px solid var(--border)', background: 'transparent', borderRadius: '0.5rem', color: 'var(--text-muted)' }}>
                                    Cancel
                                </button>
                            )}
                        </div>
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
                                        <button onClick={() => loadProfileForEdit(p)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.875rem' }} title="Edit Mapper">Edit</button>
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
