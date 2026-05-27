import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Supabase admin client — usa service role para bypass de RLS
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Valida o secret do webhook — rejeita requisiçoes não autorizadas
  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    console.error('[send-push] Requisição sem secret válido rejeitada');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Supabase webhook payload: { type, table, schema, record, old_record }
  const { record } = req.body ?? {};
  const pacienteId = record?.paciente_id;
  const descricao  = record?.descricao || 'Você tem uma nova tarefa.';

  if (!pacienteId) {
    console.error('[send-push] paciente_id ausente no payload:', JSON.stringify(req.body));
    // Retorna 200 para não disparar retry loop do webhook
    return res.status(200).json({ ok: false, error: 'paciente_id ausente' });
  }

  // Busca subscription do paciente via service role
  const { data: sub, error: subError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('paciente_id', pacienteId)
    .maybeSingle();

  if (subError) {
    console.error('[send-push] Erro ao buscar subscription:', subError.message);
    return res.status(200).json({ ok: false, error: subError.message });
  }

  if (!sub) {
    // Paciente ainda não habilitou push — situação normal, não é erro
    return res.status(200).json({ ok: true, sent: false, reason: 'sem subscription' });
  }

  const payloadPush = JSON.stringify({
    title: 'Nova tarefa',
    body:  descricao,
    url:   process.env.VITE_PACIENTE_APP_URL || 'https://copiloto-paciente.vercel.app/',
  });

  try {
    await webpush.sendNotification(sub.subscription, payloadPush);
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    if (err.statusCode === 410) {
      // 410 Gone: subscription expirada ou revogada pelo browser
      // Remove o registro para não tentar novamente em futuras tarefas
      console.log(`[send-push] Subscription expirada (410) — removendo paciente_id: ${pacienteId}`);
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .eq('id', sub.id);
      return res.status(200).json({ ok: true, sent: false, reason: 'subscription expirada, removida' });
    }
    console.error(`[send-push] Erro ao enviar push (${err.statusCode}):`, err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
