import {
  createBenefitChecklistSchema,
  parseInput,
  registerGuidedProtocolSchema,
  updateBenefitChecklistItemSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createChecklist,
  getCatalog,
  getChecklist,
  listChecklists,
  listGuidedProtocols,
  planProcedure,
  registerGuidedProtocol,
  updateChecklistItem,
} from "./service.js";

const planSchema = z.object({
  procedureKey: z.string().min(3).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD."),
  responsibleMembershipId: z.string().uuid().optional(),
});

const checklistQuerySchema = z.object({
  legalMatterId: z.string().uuid().optional(),
  administrativeProcessId: z.string().uuid().optional(),
});

type Params = {
  organizationId?: string;
  processId?: string;
  checklistId?: string;
  requirementKey?: string;
};

export async function registerAdminProcedureRoutes(app: FastifyInstance, deps: ApiDeps) {
  const org = (params: unknown) => parseInput(uuidSchema, (params as Params).organizationId);
  const processBase = "/organizations/:organizationId/administrative-processes/:processId";

  app.get("/organizations/:organizationId/administrative-procedures/catalog", async (request) => {
    const account = await requireAccount(deps, request);
    return getCatalog(account, org(request.params));
  });

  app.get(`${processBase}/guided-protocols`, async (request) => {
    const account = await requireAccount(deps, request);
    const p = request.params as Params;
    return listGuidedProtocols(deps.db, account, org(p), parseInput(uuidSchema, p.processId));
  });

  app.post(`${processBase}/guided-protocols/plan`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const p = request.params as Params;
    const input = parseInput(planSchema, request.body);
    const result = await planProcedure(
      deps.db,
      account,
      org(p),
      parseInput(uuidSchema, p.processId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${processBase}/guided-protocols`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const p = request.params as Params;
    const input = parseInput(registerGuidedProtocolSchema, request.body);
    const result = await registerGuidedProtocol(
      deps.db,
      account,
      org(p),
      parseInput(uuidSchema, p.processId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  const checklistBase = "/organizations/:organizationId/benefit-checklists";

  app.get(checklistBase, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(checklistQuerySchema, request.query ?? {});
    return listChecklists(deps.db, account, org(request.params), query);
  });

  app.post(checklistBase, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createBenefitChecklistSchema, request.body);
    const result = await createChecklist(
      deps.db,
      account,
      org(request.params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${checklistBase}/:checklistId`, async (request) => {
    const account = await requireAccount(deps, request);
    const p = request.params as Params;
    return getChecklist(deps.db, account, org(p), parseInput(uuidSchema, p.checklistId));
  });

  app.patch(`${checklistBase}/:checklistId/items/:requirementKey`, async (request) => {
    const account = await requireAccount(deps, request);
    const p = request.params as Params;
    const input = parseInput(updateBenefitChecklistItemSchema, request.body);
    return updateChecklistItem(
      deps.db,
      account,
      org(p),
      parseInput(uuidSchema, p.checklistId),
      String(p.requirementKey ?? "").slice(0, 60),
      input,
      meta(request),
    );
  });
}
