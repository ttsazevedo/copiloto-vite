import React from 'react';

export default function TelaCarregando() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f8fafc', fontFamily: "'DM Sans', system-ui, sans-serif",
      gap: 16,
    }}>
      <div style={{
        width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>Carregando…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
