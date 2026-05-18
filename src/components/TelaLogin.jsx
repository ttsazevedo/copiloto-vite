import React, { useState } from 'react';
import { signIn, signUp } from '../services/auth.js';

export default function TelaLogin({ onAuth }) {
  const [modo, setModo] = useState('login'); // login | cadastro
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !senha) { setErro('Preencha e-mail e senha.'); return; }
    if (senha.length < 6) { setErro('Senha deve ter ao menos 6 caracteres.'); return; }
    setErro('');
    setCarregando(true);
    try {
      const fn = modo === 'login' ? signIn : signUp;
      const { session, error } = await fn(email, senha);
      if (error) { setErro(error.message || 'Erro ao autenticar.'); return; }
      if (session) onAuth(session);
      else setErro('Confirme seu e-mail para continuar.');
    } finally {
      setCarregando(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: 14, border: '1.5px solid #e2e8f0',
    borderRadius: 8, outline: 'none', color: '#0f172a', background: '#fff',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  const btnStyle = {
    width: '100%', padding: '11px', fontSize: 14, fontWeight: 700, cursor: carregando ? 'default' : 'pointer',
    background: carregando ? '#a5b4fc' : '#6366f1', color: '#fff', border: 'none',
    borderRadius: 8, fontFamily: 'inherit', transition: 'background 0.15s',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f8fafc', fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 380,
        boxShadow: '0 4px 24px 0 rgba(99,102,241,0.08)', border: '1px solid #f1f5f9',
      }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            Copiloto Terapeuta
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            {modo === 'login' ? 'Entre na sua conta para continuar.' : 'Crie sua conta para começar.'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 5 }}>
              E-mail
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" autoComplete="email" style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 5 }}>
              Senha
            </label>
            <input
              type="password" value={senha} onChange={e => setSenha(e.target.value)}
              placeholder="••••••••" autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              style={inputStyle}
            />
          </div>

          {erro && (
            <div style={{
              fontSize: 12, color: '#dc2626', background: '#fff1f2', border: '1px solid #fecdd3',
              borderRadius: 8, padding: '8px 12px',
            }}>
              {erro}
            </div>
          )}

          <button type="submit" disabled={carregando} style={btnStyle}>
            {carregando ? 'Aguarde…' : modo === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
          {modo === 'login' ? (
            <>Não tem conta?{' '}
              <button onClick={() => { setModo('cadastro'); setErro(''); }}
                style={{ background: 'none', border: 'none', color: '#6366f1', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Cadastre-se
              </button>
            </>
          ) : (
            <>Já tem conta?{' '}
              <button onClick={() => { setModo('login'); setErro(''); }}
                style={{ background: 'none', border: 'none', color: '#6366f1', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Entrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
