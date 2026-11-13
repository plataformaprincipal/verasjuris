import { digitsOnly, isValidCep } from "@verasjuris/validation";

export const dynamic = "force-dynamic";

type ViaCepResponse = {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ cep: string }> },
) {
  const { cep: raw } = await context.params;
  const cep = digitsOnly(raw);
  if (!isValidCep(cep)) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Informe um CEP válido." } },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return Response.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Não foi possível consultar o CEP. Preencha o endereço manualmente.",
          },
        },
        { status: 503 },
      );
    }
    const data = (await response.json()) as ViaCepResponse;
    if (data.erro) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "CEP não encontrado. Preencha o endereço manualmente." } },
        { status: 404 },
      );
    }
    return Response.json({
      postalCode: digitsOnly(data.cep ?? cep),
      street: data.logradouro ?? "",
      complement: data.complemento ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
      country: "Brasil",
      source: "viacep",
    });
  } catch {
    return Response.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Não foi possível consultar o CEP. Preencha o endereço manualmente.",
        },
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
