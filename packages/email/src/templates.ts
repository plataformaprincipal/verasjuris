import type { EmailKind } from "./index.js";

export type EmailTemplateRenderInput = {
  kind: EmailKind;
  subject: string;
  text: string;
  actionUrl?: string;
  preheader?: string;
};

/**
 * Templates HTML responsivos alinhados à identidade VerasJuris.
 * Não incluir documentos sigilosos nem tokens em HTML além do link de ação.
 */
export function renderTransactionalEmailHtml(input: EmailTemplateRenderInput): string {
  const preheader = escapeHtml(input.preheader ?? input.subject);
  const bodyParagraphs = escapeHtml(input.text)
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;line-height:1.55;color:#1c2430;">${block.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
  const cta =
    input.actionUrl && isSafeHttpUrl(input.actionUrl)
      ? `<p style="margin:24px 0 8px;">
          <a href="${escapeAttr(input.actionUrl)}"
             style="display:inline-block;background:#0b3d2e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
            Continuar no VerasJuris
          </a>
        </p>
        <p style="margin:0 0 16px;font-size:12px;color:#5b6573;word-break:break-all;">
          Ou abra: ${escapeHtml(input.actionUrl)}
        </p>`
      : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f7;font-family:Georgia,'Times New Roman',serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #d9dee5;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0b3d2e 0%,#1a5c45 100%);padding:20px 24px;color:#ffffff;">
              <div style="font-size:20px;font-weight:700;letter-spacing:0.02em;">VerasJuris</div>
              <div style="font-size:13px;opacity:0.9;margin-top:4px;">${escapeHtml(kindLabel(input.kind))}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0b3d2e;">${escapeHtml(input.subject)}</h1>
              ${bodyParagraphs}
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px;font-size:12px;line-height:1.5;color:#5b6573;">
              Esta é uma mensagem transacional do VerasJuris. Não compartilhe links de verificação ou redefinição.
              Em caso de dúvida, acesse a plataforma pelo endereço oficial.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function kindLabel(kind: EmailKind): string {
  switch (kind) {
    case "email_verification":
      return "Confirmação de e-mail";
    case "password_reset":
      return "Redefinição de senha";
    case "organization_invitation":
      return "Convite para organização";
    case "order_confirmation":
      return "Confirmação de pedido";
    case "proposal_update":
      return "Atualização de proposta";
    case "payment_update":
      return "Atualização de pagamento";
    case "engagement_update":
      return "Atualização de contratação";
    case "juris_work_update":
      return "JurisOne Work";
    case "security_alert":
      return "Alerta de segurança";
    case "welcome":
      return "Boas-vindas";
    case "password_changed":
      return "Senha alterada";
    default:
      return "Notificação";
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function extractActionUrlFromText(text: string): string | undefined {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match?.[0];
}
