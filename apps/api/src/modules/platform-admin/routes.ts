import {
  activatePlatformInviteSchema,
  createHomologationApprovalSchema,
  createPlatformInviteSchema,
  parseInput,
  platformUserListQuerySchema,
  recordSkuEvidenceSchema,
  revokeHomologationApprovalSchema,
  updatePlatformOrgStatusSchema,
  updatePlatformUserStatusSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createHomologationApproval,
  getEvidenceReport,
  getHomologationChecklist,
  getSkuEvidence,
  recordSkuEvidence,
  revokeHomologationApproval,
} from "./homologation-service.js";
import {
  activatePlatformInvite,
  createPlatformInvite,
  getPlatformDashboard,
  getPlatformIntegrationsHealth,
  getPlatformMe,
  listPlatformOrganizations,
  listPlatformStaff,
  listPlatformUsers,
  updatePlatformOrgStatus,
  updatePlatformUserStatus,
  type PlatformAdminDeps,
} from "./service.js";
import { requirePlatformPermission } from "./authorize.js";

function homologationDeps(deps: ApiDeps) {
  return {
    db: deps.db,
    paymentHealth: async () =>
      deps.paymentProvider?.healthCheck() ?? {
        status: "not_configured",
        detail: "Provider não injetado.",
      },
  };
}

function platformDeps(deps: ApiDeps): PlatformAdminDeps {
  return {
    db: deps.db,
    gateway: deps.aiGateway,
    emailHealth: () =>
      deps.communicationEmailProvider?.healthCheck() ??
      Promise.resolve({
        status: "not_configured",
        detail: "E-mail não configurado.",
        checkedAt: new Date().toISOString(),
      }),
    paymentHealth: () =>
      deps.paymentProvider?.healthCheck() ??
      Promise.resolve({
        status: "not_configured",
        detail: "Pagamentos não configurados.",
        checkedAt: new Date().toISOString(),
      }),
    paymentsLive: process.env.PAYMENTS_LIVE === "1",
    emailProviderMode: process.env.EMAIL_PROVIDER ?? "not_configured",
    paymentProviderMode: process.env.PAYMENT_PROVIDER ?? "not_configured",
    featureAi: process.env.FEATURE_AI === "1" || process.env.FEATURE_AI === "true",
    aiProviderMode: process.env.AI_PROVIDER ?? "not_configured",
    openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY?.trim()),
  };
}

export async function registerPlatformAdminRoutes(
  app: FastifyInstance,
  deps: ApiDeps,
): Promise<void> {
  const root = "/platform";

  /** Público autenticado: estado de staff do usuário atual. */
  app.get(`${root}/me`, async (request) => {
    const account = await requireAccount(deps, request);
    return getPlatformMe(account);
  });

  /** Ativação de convite — não exige sessão (cria/atualiza conta). */
  app.post(`${root}/activate`, async (request, reply) => {
    const body = parseInput(activatePlatformInviteSchema, request.body ?? {});
    const result = await activatePlatformInvite(platformDeps(deps), body, meta(request));
    return reply.status(201).send(result);
  });

  app.get(`${root}/dashboard`, async (request) => {
    const account = await requireAccount(deps, request);
    return getPlatformDashboard(platformDeps(deps), account);
  });

  app.get(`${root}/integrations/health`, async (request) => {
    const account = await requireAccount(deps, request);
    return getPlatformIntegrationsHealth(platformDeps(deps), account);
  });

  /** Homologação live (somente leitura; nunca escreve PAYMENTS_LIVE). */
  app.get(`${root}/payments/homologation-checklist`, async (request) => {
    const account = await requireAccount(deps, request);
    return getHomologationChecklist(homologationDeps(deps), account);
  });

  app.get(`${root}/payments/homologation-report`, async (request) => {
    const account = await requireAccount(deps, request);
    return getEvidenceReport(homologationDeps(deps), account);
  });

  app.post(`${root}/payments/homologation-approvals`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createHomologationApprovalSchema, request.body ?? {});
    const result = await createHomologationApproval(
      homologationDeps(deps),
      account,
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/payments/homologation-approvals/revoke`, async (request) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(revokeHomologationApprovalSchema, request.body ?? {});
    return revokeHomologationApproval(homologationDeps(deps), account, body, meta(request));
  });

  app.get(`${root}/commerce/sku-homologation/:sku/evidence`, async (request) => {
    const account = await requireAccount(deps, request);
    const sku = z
      .string()
      .trim()
      .min(2)
      .max(64)
      .parse((request.params as { sku?: string }).sku);
    return getSkuEvidence(homologationDeps(deps), account, sku.toUpperCase());
  });

  app.post(`${root}/commerce/sku-homologation/:sku/evidence`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const sku = z
      .string()
      .trim()
      .min(2)
      .max(64)
      .parse((request.params as { sku?: string }).sku);
    const body = parseInput(recordSkuEvidenceSchema, request.body ?? {});
    const result = await recordSkuEvidence(
      homologationDeps(deps),
      account,
      sku.toUpperCase(),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/users`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(platformUserListQuerySchema, request.query ?? {});
    return listPlatformUsers(platformDeps(deps), account, query);
  });

  app.patch(`${root}/users/:userId/status`, async (request) => {
    const account = await requireAccount(deps, request);
    const userId = parseInput(uuidSchema, (request.params as { userId?: string }).userId);
    const body = parseInput(updatePlatformUserStatusSchema, request.body ?? {});
    return updatePlatformUserStatus(platformDeps(deps), account, userId, body, meta(request));
  });

  app.get(`${root}/organizations`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(
      z.object({
        q: z.string().trim().max(120).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
      }),
      request.query ?? {},
    );
    return listPlatformOrganizations(platformDeps(deps), account, query);
  });

  app.patch(`${root}/organizations/:organizationId/status`, async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(updatePlatformOrgStatusSchema, request.body ?? {});
    return updatePlatformOrgStatus(
      platformDeps(deps),
      account,
      organizationId,
      body,
      meta(request),
    );
  });

  app.get(`${root}/staff`, async (request) => {
    const account = await requireAccount(deps, request);
    return listPlatformStaff(platformDeps(deps), account);
  });

  app.post(`${root}/staff/invites`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createPlatformInviteSchema, request.body ?? {});
    const result = await createPlatformInvite(platformDeps(deps), account, body, meta(request));
    return reply.status(201).send(result);
  });
}
