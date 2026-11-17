import type { SessionAccount } from "@verasjuris/auth";
import { AppError, type PlatformPermissionKey } from "@verasjuris/types";

export function requirePlatformStaff(
  account: SessionAccount,
): NonNullable<SessionAccount["platform"]> {
  if (!account.platform || account.platform.roles.length === 0) {
    throw new AppError("AUTHORIZATION_ERROR", "Você não possui permissão para acessar esta área.");
  }
  return account.platform;
}

export function requirePlatformPermission(
  account: SessionAccount,
  permission: PlatformPermissionKey,
): NonNullable<SessionAccount["platform"]> {
  const platform = requirePlatformStaff(account);
  if (platform.forcePasswordChange) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "É necessário definir uma nova senha antes de acessar a administração.",
    );
  }
  if (platform.mfaRequired && !platform.mfaEnabled) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Configure a autenticação em dois fatores para acessar a administração.",
    );
  }
  if (!platform.permissions.includes(permission)) {
    throw new AppError("AUTHORIZATION_ERROR", "Você não possui permissão para acessar esta área.");
  }
  return platform;
}

/** Leitura do próprio estado de staff (antes de MFA/senha) — usado no bootstrap do painel. */
export function requirePlatformStaffBootstrap(
  account: SessionAccount,
): NonNullable<SessionAccount["platform"]> {
  return requirePlatformStaff(account);
}
