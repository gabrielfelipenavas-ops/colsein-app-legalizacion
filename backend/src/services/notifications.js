const db = require('../models');

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('[notifications] nodemailer no instalado — sólo notificaciones in-app activas. Ejecuta `npm install` en backend para activar email.');
}

let transporter = null;
function getTransporter() {
  if (!nodemailer) return null;
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const FROM = process.env.SMTP_FROM || 'COLSEIN Legalizaciones <no-reply@colsein.co>';

const REF_LABEL = {
  kilometraje: 'Reporte de Kilometraje',
  anticipo: 'Solicitud de Anticipo',
  legalizacion: 'Legalización de Gastos',
};

function htmlTemplate({ titulo, mensaje, ref_tipo, ref_id, comentarios }) {
  const refLabel = REF_LABEL[ref_tipo] || '';
  const link = ref_tipo
    ? `${APP_URL}/${ref_tipo === 'kilometraje' ? 'km' : ref_tipo === 'anticipo' ? 'viajes' : 'legalizacion'}`
    : APP_URL;
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">COLSEIN S.A.S.</h2>
        <p style="margin: 4px 0 0; opacity: 0.85; font-size: 13px;">Sistema de Legalizaciones</p>
      </div>
      <div style="background: #fff; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <h3 style="margin: 0 0 12px; color: #0f172a;">${titulo}</h3>
        <p style="margin: 0 0 16px; color: #475569; font-size: 14px; line-height: 1.6;">${mensaje}</p>
        ${refLabel ? `<p style="margin: 0 0 12px; color: #64748b; font-size: 13px;"><strong>Tipo:</strong> ${refLabel}${ref_id ? ` #${ref_id}` : ''}</p>` : ''}
        ${comentarios ? `<div style="background:#fef3c7; border-left: 3px solid #f59e0b; padding: 12px; margin: 16px 0; border-radius: 4px; font-size: 13px; color: #78350f;"><strong>Comentario del aprobador:</strong><br>${comentarios}</div>` : ''}
        <a href="${link}" style="display: inline-block; background: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 8px; font-size: 14px;">Ver en la app</a>
        <p style="margin: 24px 0 0; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 12px;">Este es un mensaje automático, por favor no respondas a este correo.</p>
      </div>
    </div>
  `;
}

async function notify({ user_id, tipo = 'info', titulo, mensaje, ref_tipo = null, ref_id = null, comentarios = null }) {
  if (!user_id || !titulo || !mensaje) {
    console.warn('[notifications] notify() requiere user_id, titulo y mensaje');
    return null;
  }

  let notif = null;
  try {
    notif = await db.Notification.create({
      user_id,
      tipo,
      titulo,
      mensaje,
      ref_tipo,
      ref_id,
      leida: false,
      email_enviado: false,
    });
  } catch (err) {
    console.error('[notifications] Error creando notificación in-app:', err.message);
  }

  const t = getTransporter();
  if (!t) return notif;

  try {
    const user = await db.User.findByPk(user_id, { attributes: ['email', 'nombre'] });
    if (!user || !user.email) return notif;

    await t.sendMail({
      from: FROM,
      to: user.email,
      subject: `[COLSEIN] ${titulo}`,
      html: htmlTemplate({ titulo, mensaje, ref_tipo, ref_id, comentarios }),
    });

    if (notif) await notif.update({ email_enviado: true });
  } catch (err) {
    console.error('[notifications] Error enviando email:', err.message);
  }

  return notif;
}

async function notifyRoles(roles, payload) {
  try {
    const recipients = await db.User.findAll({
      where: { rol: roles, activo: true },
      attributes: ['id'],
    });
    await Promise.all(recipients.map(u => notify({ ...payload, user_id: u.id })));
  } catch (err) {
    console.error('[notifications] Error notificando roles:', err.message);
  }
}

module.exports = { notify, notifyRoles };
