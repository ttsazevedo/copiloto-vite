import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const LINHA_LABELS = {
  tcc: 'Terapia Cognitivo-Comportamental (TCC)',
  psicanalise: 'Psicanálise',
  gestalt: 'Gestalt-terapia',
  junguiana: 'Psicologia Analítica Junguiana',
  humanista: 'Humanista / ACP',
  comportamental: 'Análise do Comportamento',
};

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function secao(titulo, conteudo, bgHeader = '#f8fafc', borderColor = '#e2e8f0') {
  return `
    <div style="margin-bottom:16px;border:1px solid ${borderColor};border-radius:8px;overflow:hidden;">
      <div style="background:${bgHeader};padding:7px 14px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">
        ${titulo}
      </div>
      <div style="padding:12px 14px;font-size:12px;color:#1e293b;line-height:1.7;">
        ${conteudo}
      </div>
    </div>
  `;
}

export async function exportarPlanoPDF(plano, paciente, terapeutaPerfil) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const abordagem = LINHA_LABELS[paciente.linha] || paciente.linha || 'Não especificada';
  const nomePacienteArquivo = (paciente.nome || 'paciente').replace(/[^a-zA-Z0-9]/g, '_');
  const nomeArquivo = `Plano_${nomePacienteArquivo}_${hoje.replace(/\//g, '-')}.pdf`;

  const tratamento = terapeutaPerfil?.tratamento || '';
  const nomeTerapeuta = terapeutaPerfil?.nome || '';
  const crp = terapeutaPerfil?.crp || '';
  const numSessao = (paciente.sessoes || 0) + 1;
  const contexto = plano.contextoUtilizado ?? '—';

  const fluxoHtml = (plano.fluxoSocratico || []).map((eixo, i) => `
    <div style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:12px;color:#6366f1;margin-bottom:3px;">
        Eixo ${i + 1} — ${esc(eixo.eixo)}
      </div>
      ${eixo.descricao ? `<div style="font-size:11px;color:#64748b;margin-bottom:5px;font-style:italic;">${esc(eixo.descricao)}</div>` : ''}
      ${(eixo.perguntas || []).map((p, j) => `
        <div style="margin-bottom:4px;padding:5px 10px;border-left:3px solid #c7d2fe;background:#f5f3ff;">
          <span style="font-size:10px;font-weight:700;color:#818cf8;">P${j + 1}  </span>
          <span style="font-size:12px;color:#1e293b;">${esc(p.texto)}</span>
        </div>
      `).join('')}
    </div>
  `).join('');

  const itensHtml = (plano.itensRevisar || []).map(item => `
    <div style="display:flex;gap:8px;margin-bottom:4px;">
      <span style="color:#6366f1;font-weight:700;flex-shrink:0;">•</span>
      <span>${esc(item)}</span>
    </div>
  `).join('');

  const tecnicasHtml = (plano.tecnicas || []).map(t => `
    <span style="display:inline-block;padding:3px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px;font-size:11px;color:#166534;margin:2px 3px 2px 0;">${esc(t)}</span>
  `).join('');

  const terapeutaLine = nomeTerapeuta
    ? `<div style="margin-top:10px;font-size:11px;opacity:0.85;">${esc(tratamento)} ${esc(nomeTerapeuta)}${crp ? ` — CRP: ${esc(crp)}` : ''}</div>`
    : '';

  const html = `
    <div style="padding:36px;font-family:Arial,sans-serif;color:#1e293b;font-size:12px;line-height:1.6;width:794px;box-sizing:border-box;background:#fff;">

      <div style="background:#6366f1;color:white;padding:22px 24px;border-radius:10px;margin-bottom:18px;">
        <div style="font-size:18px;font-weight:700;margin-bottom:2px;">Copiloto Terapeuta</div>
        <div style="font-size:12px;opacity:0.85;">Plano de Sessão</div>
        ${terapeutaLine}
        <div style="font-size:10px;opacity:0.7;margin-top:4px;">Gerado em ${hoje}</div>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:18px;">
        <div style="display:flex;gap:0;flex-wrap:wrap;">
          <div style="margin-right:28px;margin-bottom:4px;">
            <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:1px;">Paciente</div>
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${esc(paciente.nome)}</div>
          </div>
          <div style="margin-right:28px;margin-bottom:4px;">
            <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:1px;">Abordagem</div>
            <div style="font-size:12px;font-weight:600;color:#6366f1;">${esc(abordagem)}</div>
          </div>
          <div style="margin-right:28px;margin-bottom:4px;">
            <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:1px;">Sessão nº</div>
            <div style="font-size:12px;font-weight:600;">${numSessao}</div>
          </div>
          <div style="margin-bottom:4px;">
            <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:1px;">Sessões no contexto</div>
            <div style="font-size:12px;font-weight:600;">${contexto}</div>
          </div>
        </div>
      </div>

      ${secao('Objetivo da Sessão', `<div>${esc(plano.objetivo || '')}</div>`)}

      ${(plano.itensRevisar || []).length ? secao('Itens para Revisar no Início', itensHtml) : ''}

      ${secao('Foco Principal', `<div style="white-space:pre-wrap;">${esc(plano.focoPrincipal || '')}</div>`)}

      ${(plano.fluxoSocratico || []).length ? secao('Fluxo Socrático', fluxoHtml, '#f5f3ff', '#ddd6fe') : ''}

      ${(plano.tecnicas || []).length ? secao('Técnicas Sugeridas', `<div>${tecnicasHtml}</div>`) : ''}

      ${secao('Tarefa de Casa', `<div style="white-space:pre-wrap;">${esc(plano.tarefa || '')}</div>`, '#fffbeb', '#fde68a')}

      ${plano.obs ? secao('Observações Clínicas', `<div style="white-space:pre-wrap;">${esc(plano.obs)}</div>`, '#fff7ed', '#fed7aa') : ''}

      <div style="margin-top:20px;padding:12px 14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:10px;color:#94a3b8;max-width:65%;">
          Documento gerado pelo Copiloto Terapeuta. Uso restrito ao profissional responsável.
        </div>
        <div style="font-size:11px;color:#64748b;font-weight:600;">
          Duração sugerida: ${esc(plano.duracaoSugerida || '50 min')}
        </div>
      </div>

    </div>
  `;

  const container = document.createElement('div');
  container.id = 'pdf-plano-container';
  container.style.cssText = 'position:absolute;left:-9999px;top:0;background:#fff;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * pageW) / canvas.width;

    let posY = 0;
    pdf.addImage(imgData, 'PNG', 0, posY, imgW, imgH);
    let remaining = imgH - pageH;

    while (remaining > 0) {
      posY -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, posY, imgW, imgH);
      remaining -= pageH;
    }

    pdf.save(nomeArquivo);
  } finally {
    document.body.removeChild(container);
  }
}
