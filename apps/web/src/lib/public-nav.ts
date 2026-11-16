/**
 * Compatibilidade: navegação pública agora vive em platform-nav.
 */
export {
  isPlatformTabActive as isPublicTabActive,
  PLATFORM_MAIN_TABS,
  PUBLIC_MAIN_TABS,
  type PlatformMainTab as PublicMainTab,
} from "./platform-nav";
