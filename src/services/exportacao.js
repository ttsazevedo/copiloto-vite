function triggerDownload(conteudo, nomeArquivo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportarJSON(paciente, sessoes, planos, tarefas) {
  const exportado = {
    _meta: {
      exportado_em: new Date().toISOString(),
      paciente_nome: paciente.nome,
      versao: '1.0',
      base_legal: 'LGPD Art. 18 — Direito de portabilidade',
    },
    paciente: {
      id:                paciente.id,
      nome:              paciente.nome,
      queixa:            paciente.queixa,
      objetivo:          paciente.objetivo,
      linha_terapeutica: paciente.linha_terapeutica,
      criado_em:         paciente.criado_em,
    },
    sessoes:  sessoes  ?? [],
    planos:   planos   ?? [],
    tarefas:  tarefas  ?? [],
  };

  const slug = paciente.nome.replace(/\s+/g, '_');
  const data = new Date().toISOString().split('T')[0];
  triggerDownload(
    JSON.stringify(exportado, null, 2),
    `${slug}_dados_${data}.json`,
    'application/json'
  );
}

export function exportarCSV(paciente, sessoes) {
  const cabecalho = [
    `# Exportação de sessões — ${paciente.nome}`,
    `# Data: ${new Date().toLocaleString('pt-BR')}`,
    `# Base legal: LGPD Art. 18 — Direito de portabilidade`,
    '',
  ].join('\n');

  const colunas = [
    'numero', 'data', 'resumo', 'objetivo',
    'humor_inicio', 'humor_fim', 'tarefa', 'resultado_tarefa',
    'temas', 'distorcoes',
  ];

  const escaparCampo = (val) => {
    // Arrays (temas, distorcoes) exportados como string separada por ponto-e-vírgula
    const str = String(Array.isArray(val) ? val.join(';') : (val ?? '')).replace(/"/g, '""');
    return /[,\n"]/.test(str) ? `"${str}"` : str;
  };

  const linhas = (sessoes ?? []).map(s =>
    colunas.map(col => escaparCampo(s[col])).join(',')
  );

  const slug = paciente.nome.replace(/\s+/g, '_');
  const data = new Date().toISOString().split('T')[0];
  // BOM ﻿ garante abertura correta no Excel/Numbers com acentos
  triggerDownload(
    '﻿' + cabecalho + colunas.join(',') + '\n' + linhas.join('\n'),
    `${slug}_sessoes_${data}.csv`,
    'text/csv;charset=utf-8'
  );
}
