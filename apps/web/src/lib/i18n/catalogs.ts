import type { Locale } from "./locales";
import arSA from "./messages/ar-SA.json";
import bnBD from "./messages/bn-BD.json";
import deDE from "./messages/de-DE.json";
import enGB from "./messages/en-GB.json";
import enUS from "./messages/en-US.json";
import esAR from "./messages/es-AR.json";
import esES from "./messages/es-ES.json";
import esMX from "./messages/es-MX.json";
import faIR from "./messages/fa-IR.json";
import frFR from "./messages/fr-FR.json";
import heIL from "./messages/he-IL.json";
import hiIN from "./messages/hi-IN.json";
import idID from "./messages/id-ID.json";
import itIT from "./messages/it-IT.json";
import jaJP from "./messages/ja-JP.json";
import koKR from "./messages/ko-KR.json";
import msMY from "./messages/ms-MY.json";
import nlNL from "./messages/nl-NL.json";
import plPL from "./messages/pl-PL.json";
import ptBR from "./messages/pt-BR.json";
import ptPT from "./messages/pt-PT.json";
import roRO from "./messages/ro-RO.json";
import ruRU from "./messages/ru-RU.json";
import svSE from "./messages/sv-SE.json";
import thTH from "./messages/th-TH.json";
import trTR from "./messages/tr-TR.json";
import ukUA from "./messages/uk-UA.json";
import viVN from "./messages/vi-VN.json";
import zhCN from "./messages/zh-CN.json";
import zhTW from "./messages/zh-TW.json";

export type MessageCatalog = typeof ptBR;
export type MessageKey = keyof MessageCatalog & string;
export type Catalog = Record<string, string>;

export const MESSAGE_CATALOGS: Record<Locale, MessageCatalog> = {
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  "en-US": enUS,
  "en-GB": enGB,
  "es-ES": esES,
  "es-MX": esMX,
  "es-AR": esAR,
  "fr-FR": frFR,
  "de-DE": deDE,
  "it-IT": itIT,
  "nl-NL": nlNL,
  "pl-PL": plPL,
  "ro-RO": roRO,
  "uk-UA": ukUA,
  "ru-RU": ruRU,
  "tr-TR": trTR,
  "ar-SA": arSA,
  "he-IL": heIL,
  "fa-IR": faIR,
  "hi-IN": hiIN,
  "bn-BD": bnBD,
  "id-ID": idID,
  "ms-MY": msMY,
  "th-TH": thTH,
  "vi-VN": viVN,
  "ja-JP": jaJP,
  "ko-KR": koKR,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "sv-SE": svSE,
};

export const SOURCE_KEYS = Object.keys(ptBR) as MessageKey[];
