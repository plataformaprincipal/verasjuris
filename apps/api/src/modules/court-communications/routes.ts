import {
  courtCommunicationListQuerySchema,
  createCourtMonitorSchema,
  dismissCourtCommunicationSchema,
  linkCourtCommunicationSchema,
  parseInput,
  runCourtMonitorSchema,
  triageCourtCommunicationSchema,
  updateCourtMonitorSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createMonitor,
  dismissCommunication,
  getCommunication,
  linkCommunication,
  listCommunications,
  listMonitors,
  listOabSuggestions,
  runMonitorNow,
  searchProcessOptions,
  syncProcessFromDatajud,
  triageCommunication,
  updateMonitor,
  type CourtCommunicationDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  monitorId?: string;
  communicationId?: string;
  processId?: string;
};

function ids(params: unknown) {
  const p = params as Params;
  return {
    organizationId: parseInput(uuidSchema, p.organizationId),
    monitorId: p.monitorId ? parseInput(uuidSchema, p.monitorId) : "",
    communicationId: p.communicationId ? parseInput(uuidSchema, p.communicationId) : "",
    processId: p.processId ? parseInput(uuidSchema, p.processId) : "",
  };
}

export async function registerCourtCommunicationRoutes(
  app: FastifyInstance,
  deps: ApiDeps,
  court: CourtCommunicationDeps,
) {
  const root = "/organizations/:organizationId/court-communications";

  app.get(`${root}/monitors`, async (request) => {
    const account = await requireAccount(deps, request);
    return listMonitors(deps.db, account, ids(request.params).organizationId);
  });

  app.get(`${root}/monitors/suggestions`, async (request) => {
    const account = await requireAccount(deps, request);
    return listOabSuggestions(deps.db, account, ids(request.params).organizationId);
  });

  app.post(`${root}/monitors`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCourtMonitorSchema, request.body);
    const result = await createMonitor(
      deps.db,
      account,
      ids(request.params).organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${root}/monitors/:monitorId`, async (request) => {
    const account = await requireAccount(deps, request);
    const { organizationId, monitorId } = ids(request.params);
    const input = parseInput(updateCourtMonitorSchema, request.body);
    return updateMonitor(deps.db, account, organizationId, monitorId, input, meta(request));
  });

  app.post(`${root}/monitors/:monitorId/run`, async (request) => {
    const account = await requireAccount(deps, request);
    const { organizationId, monitorId } = ids(request.params);
    const input = parseInput(runCourtMonitorSchema, request.body ?? {});
    return runMonitorNow(deps.db, court, account, organizationId, monitorId, input);
  });

  app.get(root, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(courtCommunicationListQuerySchema, request.query ?? {});
    return listCommunications(deps.db, account, ids(request.params).organizationId, query);
  });

  app.get(`${root}/process-options`, async (request) => {
    const account = await requireAccount(deps, request);
    const q = String((request.query as { q?: unknown } | undefined)?.q ?? "").slice(0, 100);
    return searchProcessOptions(deps.db, account, ids(request.params).organizationId, q);
  });

  app.get(`${root}/:communicationId`, async (request) => {
    const account = await requireAccount(deps, request);
    const { organizationId, communicationId } = ids(request.params);
    return getCommunication(deps.db, account, organizationId, communicationId);
  });

  app.post(`${root}/:communicationId/link`, async (request) => {
    const account = await requireAccount(deps, request);
    const { organizationId, communicationId } = ids(request.params);
    const input = parseInput(linkCourtCommunicationSchema, request.body);
    return linkCommunication(
      deps.db,
      account,
      organizationId,
      communicationId,
      input,
      meta(request),
    );
  });

  app.post(`${root}/:communicationId/dismiss`, async (request) => {
    const account = await requireAccount(deps, request);
    const { organizationId, communicationId } = ids(request.params);
    const input = parseInput(dismissCourtCommunicationSchema, request.body);
    return dismissCommunication(
      deps.db,
      account,
      organizationId,
      communicationId,
      input,
      meta(request),
    );
  });

  app.post(`${root}/:communicationId/triage`, async (request) => {
    const account = await requireAccount(deps, request);
    const { organizationId, communicationId } = ids(request.params);
    const input = parseInput(triageCourtCommunicationSchema, request.body);
    return triageCommunication(
      deps.db,
      account,
      organizationId,
      communicationId,
      input,
      meta(request),
    );
  });

  app.post(
    "/organizations/:organizationId/judicial-processes/:processId/datajud-sync",
    async (request) => {
      const account = await requireAccount(deps, request);
      const { organizationId, processId } = ids(request.params);
      return syncProcessFromDatajud(
        deps.db,
        court,
        account,
        organizationId,
        processId,
        meta(request),
      );
    },
  );
}
