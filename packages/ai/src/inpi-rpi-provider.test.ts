import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractTrademarkProcesses, InpiRpiProvider } from "./inpi-rpi-provider.js";

const SAMPLE_RPI = `<?xml version="1.0" encoding="UTF-8"?>
<revista numero="2915" data="17/11/2026">
  <processo numero="912345678" data-deposito="10/01/2026">
    <despachos>
      <despacho codigo="IPAS423" nome="Notificação de oposição">
        <texto-complementar>Oposição apresentada por terceiro.</texto-complementar>
      </despacho>
    </despachos>
    <titulares><titular nome-razao-social="CAFÉ PLATINE LTDA" pais="BR" uf="PB"/></titulares>
    <marca apresentacao="Mista" natureza="De Serviço"><nome>VERASJURIS</nome></marca>
    <lista-classe-nice><classe-nice codigo="45" edicao="12"><especificacao>Serviços jurídicos</especificacao></classe-nice></lista-classe-nice>
    <procurador>Fulana de Tal Advocacia</procurador>
  </processo>
  <processo numero="900000001" data-deposito="01/02/2026">
    <despachos><despacho codigo="IPAS009" nome="Publicação de pedido de registro para oposição"/></despachos>
    <titulares><titular nome-razao-social="OUTRA EMPRESA" pais="BR" uf="SP"/></titulares>
    <marca apresentacao="Nominativa" natureza="De Produto"><nome>OUTRA</nome></marca>
    <procurador>Escritório Diferente</procurador>
  </processo>
  <processo numero="933333333" data-deposito="05/03/2026">
    <despachos><despacho codigo="IPAS158" nome="Deferimento do pedido"/></despachos>
    <titulares><titular nome-razao-social="CLIENTE NOVO SA" pais="BR" uf="PB"/></titulares>
    <marca apresentacao="Nominativa" natureza="De Produto"><nome>NOVA MARCA</nome></marca>
    <procurador>FULANA DE TAL ADVOCACIA</procurador>
  </processo>
</revista>`;

describe("RPI do INPI", () => {
  it("recorta só os processos de interesse (número e procurador)", () => {
    const result = extractTrademarkProcesses(SAMPLE_RPI, {
      processNumbers: ["912.345.678"],
      attorneyNames: ["fulana de tal"],
    });
    expect(result.edition).toBe(2915);
    expect(result.publishedOn).toBe("2026-11-17");
    expect(result.processes.map((p) => p.processNumber).sort()).toEqual(["912345678", "933333333"]);
    const own = result.processes.find((p) => p.processNumber === "912345678")!;
    expect(own).toMatchObject({
      markName: "VERASJURIS",
      presentation: "Mista",
      filedOn: "2026-01-10",
      attorney: "Fulana de Tal Advocacia",
      niceClasses: ["45"],
    });
    expect(own.holders[0]).toEqual({ name: "CAFÉ PLATINE LTDA", country: "BR", uf: "PB" });
    expect(own.dispatches[0]).toEqual({
      code: "IPAS423",
      name: "Notificação de oposição",
      complement: "Oposição apresentada por terceiro.",
    });
  });

  it("descobre a edição mais recente no índice e descompacta o XML", async () => {
    const zip = zipSync({ "RM2915.xml": strToU8(SAMPLE_RPI) });
    const seen: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      seen.push(url);
      if (url.endsWith("/rpi/")) {
        return new Response('<a href="/txt/RM2914.zip">2914</a><a href="/txt/RM2915.zip">2915</a>');
      }
      return new Response(zip);
    }) as typeof fetch;
    const provider = new InpiRpiProvider({ fetchImpl });
    expect(await provider.latestEdition()).toBe(2915);
    const edition = await provider.trademarkEdition(2915, { processNumbers: ["900000001"] });
    expect(edition.processes).toHaveLength(1);
    expect(seen.at(-1)).toBe("https://revistas.inpi.gov.br/txt/RM2915.zip");
  });
});
