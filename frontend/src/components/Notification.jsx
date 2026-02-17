import React, { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

const Notification = ({ message, type = 'info', duration = 10000, onClose }) => {
    const [visible, setVisible] = useState(true)

    useEffect(() => {
        if (duration) {
            const timer = setTimeout(() => {
                handleClose()
            }, duration)
            return () => clearTimeout(timer)
        }
    }, [duration])

    const handleClose = () => {
        setVisible(false)
        setTimeout(onClose, 300) // matches transition duration
    }

    const icons = {
        success: <CheckCircle className="text-success" size={20} />,
        error: <AlertCircle className="text-danger" size={20} />,
        info: <Info className="text-primary" size={20} />
    }

    const colors = {
        success: 'rgba(16, 185, 129, 0.1)',
        error: 'rgba(239, 68, 68, 0.1)',
        info: 'rgba(99, 102, 241, 0.1)'
    }

    const borders = {
        success: 'var(--success)',
        error: 'var(--danger)',
        info: 'var(--primary)'
    }

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '2rem',
                right: '2rem',
                zIndex: 1000,
                padding: '1rem 1.5rem',
                borderRadius: '0.75rem',
                background: 'var(--bg-surface)',
                border: `1px solid ${borders[type]}`,
                backgroundColor: colors[type],
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                maxWidth: '400px'
            }}
        >
            {icons[type]}
            <div style={{ flex: 1, color: 'var(--text-main)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                {message}
            </div>
            <button
                onClick={handleClose}
                style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: '0.25rem'
                }}
            >
                <X size={16} />
            </button>
        </div>
    )
}

export default Notification
