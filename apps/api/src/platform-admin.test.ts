import { describe, expect, it } from "vitest";
import {
  collectPlatformPermissions,
  PLATFORM_ROLE_PERMISSIONS,
  type PlatformRoleKey,
} from "@verasjuris/types";
import { AppError } from "@verasjuris/types";
import type { SessionAccount } from "@verasjuris/auth";
import {
  requirePlatformPermission,
  requirePlatformStaff,
} from "./modules/platform-admin/authorize.js";

function account(partial?: Partial<SessionAccount["platform"]>): SessionAccount {
  return {
    sessionId: "00000000-0000-4000-8000-000000000001",
    user: {
      id: "00000000-0000-4000-8000-000000000002",
      email: "acesseverasjuris@gmail.com",
      displayName: "Admin",
      locale: "pt-BR",
      timeZone: "America/Sao_Paulo",
      status: "active",
      emailVerifiedAt: new Date(),
      onboardingPersona: null,
    },
    professionalVerificationStatus: "not_submitted",
    memberships: [],
    platform: {
      roles: ["SUPER_ADMIN"],
      permissions: [...PLATFORM_ROLE_PERMISSIONS.SUPER_ADMIN],
      mfaRequired: true,
      forcePasswordChange: false,
      mfaEnabled: true,
      ...partial,
    },
  };
}

describe("platform admin RBAC", () => {
  it("SUPER_ADMIN collects all platform permissions", () => {
    const perms = collectPlatformPermissions(["SUPER_ADMIN"]);
    expect(perms).toContain("platform.staff.manage");
    expect(perms).toContain("platform.finance.refund");
    expect(perms.length).toBe(PLATFORM_ROLE_PERMISSIONS.SUPER_ADMIN.length);
  });

  it("SUPORTE cannot manage staff", () => {
    const role: PlatformRoleKey = "SUPORTE";
    expect(PLATFORM_ROLE_PERMISSIONS[role]).not.toContain("platform.staff.manage");
  });

  it("requirePlatformStaff rejects non-staff", () => {
    const guest = account();
    guest.platform = null;
    expect(() => requirePlatformStaff(guest)).toThrow(AppError);
  });

  it("requirePlatformPermission enforces MFA for admin", () => {
    const pendingMfa = account({ mfaEnabled: false, mfaRequired: true });
    expect(() => requirePlatformPermission(pendingMfa, "platform.dashboard.read")).toThrow(
      /dois fatores|two.?factor|MFA|autenticação/i,
    );
  });

  it("requirePlatformPermission allows ready SUPER_ADMIN", () => {
    const ready = account();
    expect(requirePlatformPermission(ready, "platform.dashboard.read").roles).toContain(
      "SUPER_ADMIN",
    );
  });
});
