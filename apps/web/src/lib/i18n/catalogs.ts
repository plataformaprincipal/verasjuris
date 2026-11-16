import type { Locale } from "./locales";
import enUS from "./messages/en-US.json";
import esES from "./messages/es-ES.json";
import ptBR from "./messages/pt-BR.json";

export type MessageCatalog = typeof ptBR;
export type MessageKey = keyof MessageCatalog & string;
export type Catalog = Record<string, string>;

export const MESSAGE_CATALOGS: Record<Locale, MessageCatalog> = {
  "pt-BR": ptBR,
  "en-US": enUS,
  "es-ES": esES,
};

export const SOURCE_KEYS = Object.keys(ptBR) as MessageKey[];
