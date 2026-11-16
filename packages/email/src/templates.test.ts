import { describe, expect, it } from "vitest";
import { extractActionUrlFromText, renderTransactionalEmailHtml } from "./templates.js";

describe("email templates", () => {
  it("renderiza HTML com marca VerasJuris e escapa conteúdo", () => {
    const html = renderTransactionalEmailHtml({
      kind: "payment_update",
      subject: "Pagamento confirmado",
      text: "Seu pagamento foi confirmado.\n\n<script>alert(1)</script>",
      actionUrl: "https://app.verasjuris.example/pedidos/1",
    });
    expect(html).toContain("VerasJuris");
    expect(html).toContain("Atualização de pagamento");
    expect(html).toContain("https://app.verasjuris.example/pedidos/1");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("extrai URL segura do texto", () => {
    expect(extractActionUrlFromText("Abra https://exemplo.com/x agora")).toBe(
      "https://exemplo.com/x",
    );
  });
});
