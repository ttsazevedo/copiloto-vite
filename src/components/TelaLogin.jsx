import React, { useState } from 'react';
import { signIn, signUp } from '../services/auth.js';

// ─── Paleta Vinculi ────────────────────────────────────────────────────────────
const V = {
  laranja:   "#E28743",
  dourado:   "#EAB852",
  rosa:      "#F1A7A6",
  grafite:   "#2C302E",
  rosaClaro: "#FDF0EF",
  rosaSuave: "#FAE8E7",
};

// ─── SVG: Ícone isolado ────────────────────────────────────────────────────────
const VinculiIconLogin = ({ size = 48 }) => (
  <svg width={size} height={Math.round(size * 0.82)} viewBox="0 0 44 36" fill="none">
    <ellipse cx="18" cy="18" rx="14" ry="8.5" transform="rotate(-32 18 18)" fill={V.laranja} opacity="0.92"/>
    <ellipse cx="26" cy="18" rx="14" ry="8.5" transform="rotate(32 26 18)"  fill={V.dourado} opacity="0.85"/>
    <circle  cx="22" cy="18" r="3.8" fill={V.rosa} opacity="0.97"/>
  </svg>
);

// ─── SVG: Assinatura Preferencial (horizontal) ───────────────────────────────
const VinculiAssinaturaLogin = ({ size = 28 }) => (
  <div style={{ display:"flex", alignItems:"center", gap:9, userSelect:"none" }}>
    <VinculiIconLogin size={size} />
    <span style={{
      fontFamily:"'Playfair Display', 'Lora', Georgia, serif",
      fontSize: Math.round(size * 0.72),
      fontWeight: 400,
      color: V.grafite,
      letterSpacing: "0.04em",
      lineHeight: 1,
    }}>
      Vinculi
    </span>
  </div>
);

// ─── Componente principal ──────────────────────────────────────────────────────
export default function TelaLogin({ onAuth }) {
  const [modo, setModo]           = useState('login');
  const [email, setEmail]         = useState('');
  const [senha, setSenha]         = useState('');
  const [erro, setErro]           = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !senha) { setErro('Preencha e-mail e senha.'); return; }
    if (senha.length < 6)  { setErro('Senha deve ter ao menos 6 caracteres.'); return; }
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

  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      minHeight:'100vh',
      background:`linear-gradient(160deg, ${V.rosaClaro} 0%, #FFFFFF 55%, #FAFAF8 100%)`,
      fontFamily:"'DM Sans', system-ui, sans-serif",
      padding:'24px 16px',
    }}>

      {/* ── Topo: wordmark Vinculi ── */}
      <div style={{ textAlign:'center', marginBottom:36 }}>
        <div style={{
          fontFamily:"'Playfair Display', 'Lora', Georgia, serif",
          fontSize:44, fontWeight:400, color:V.grafite,
          letterSpacing:'0.05em', lineHeight:1, marginBottom:10,
        }}>
          Vinculi
        </div>
        <div style={{
          fontSize:13, color:'#8a7b75', fontWeight:400,
          letterSpacing:'0.04em', lineHeight:1.4,
        }}>
          O elo entre terapeuta e paciente
        </div>
      </div>

      {/* ── Card do formulário ── */}
      <div style={{
        background:'#FFFFFF',
        borderRadius:20,
        padding:'36px 32px 32px',
        width:'100%', maxWidth:380,
        boxShadow:`0 2px 32px 0 rgba(226,135,67,0.10), 0 1px 4px 0 rgba(44,48,46,0.06)`,
        border:`1px solid ${V.rosaSuave}`,
      }}>

        {/* Título do card */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:16, fontWeight:700, color:V.grafite, marginBottom:4 }}>
            {modo === 'login' ? 'Acesse sua conta' : 'Crie sua conta'}
          </div>
          <div style={{ fontSize:12, color:'#94a3b8' }}>
            {modo === 'login'
              ? 'Entre para acompanhar seus pacientes.'
              : 'Comece a usar o Copiloto Vinculi.'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* E-mail */}
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:5, letterSpacing:'0.04em', textTransform:'uppercase' }}>
              E-mail
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" autoComplete="email"
              style={{
                width:'100%', padding:'10px 14px', fontSize:14,
                border:`1.5px solid #E8E0DB`,
                borderRadius:10, outline:'none', color:V.grafite, background:'#FAFAF8',
                fontFamily:'inherit', boxSizing:'border-box', transition:'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = V.laranja}
              onBlur={e => e.target.style.borderColor = '#E8E0DB'}
            />
          </div>

          {/* Senha */}
          <div>
            <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:5, letterSpacing:'0.04em', textTransform:'uppercase' }}>
              Senha
            </label>
            <input
              type="password" value={senha} onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              style={{
                width:'100%', padding:'10px 14px', fontSize:14,
                border:'1.5px solid #E8E0DB',
                borderRadius:10, outline:'none', color:V.grafite, background:'#FAFAF8',
                fontFamily:'inherit', boxSizing:'border-box', transition:'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = V.laranja}
              onBlur={e => e.target.style.borderColor = '#E8E0DB'}
            />
          </div>

          {/* Erro */}
          {erro && (
            <div style={{
              fontSize:12, color:'#b45309', background:'#fffbeb',
              border:'1px solid #fde68a', borderRadius:8, padding:'8px 12px',
            }}>
              {erro}
            </div>
          )}

          {/* Botão CTA */}
          <button
            type="submit" disabled={carregando}
            style={{
              width:'100%', padding:'12px',
              fontSize:14, fontWeight:700, cursor: carregando ? 'default' : 'pointer',
              background: carregando ? '#E8C9A8' : V.laranja,
              color:'#fff', border:'none', borderRadius:10,
              fontFamily:'inherit', transition:'background 0.15s',
              letterSpacing:'0.02em',
            }}
          >
            {carregando ? 'Aguarde…' : modo === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        {/* Link alternar modo */}
        <div style={{ marginTop:18, textAlign:'center', fontSize:13, color:'#94a3b8' }}>
          {modo === 'login' ? (
            <>Não tem conta?{' '}
              <button onClick={() => { setModo('cadastro'); setErro(''); }}
                style={{ background:'none', border:'none', color:V.laranja, fontWeight:700, cursor:'pointer', fontSize:13 }}>
                Cadastre-se
              </button>
            </>
          ) : (
            <>Já tem conta?{' '}
              <button onClick={() => { setModo('login'); setErro(''); }}
                style={{ background:'none', border:'none', color:V.laranja, fontWeight:700, cursor:'pointer', fontSize:13 }}>
                Entrar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Links legais */}
      <div style={{ marginTop: 16, marginBottom: 8, textAlign: 'center', fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
        Ao continuar, você concorda com os{' '}
        <a href="https://copiloto-vite.vercel.app/TERMOS_DE_USO.md"
           target="_blank" rel="noopener noreferrer"
           style={{ color: '#94a3b8', textDecoration: 'underline' }}>
          Termos de Uso
        </a>
        {' '}e a{' '}
        <a href="https://copiloto-vite.vercel.app/POLITICA_PRIVACIDADE.md"
           target="_blank" rel="noopener noreferrer"
           style={{ color: '#94a3b8', textDecoration: 'underline' }}>
          Política de Privacidade
        </a>
      </div>

      {/* ── Rodapé: Assinatura Preferencial ── */}
      <div style={{ marginTop:40, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
        <VinculiAssinaturaLogin size={26} />
        <div style={{ fontSize:11, color:'#b8a9a4', letterSpacing:'0.03em' }}>
          O elo entre terapeuta e paciente — antes, durante e depois da sessão.
        </div>
      </div>

    </div>
  );
}
