import { parseInput, uuidSchema } from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  addInpiAttorney,
  addInpiProcess,
  dismissInpiDispatch,
  listInpiDispatches,
  listInpiMonitors,
  runInpiNow,
  setInpiAttorneyActive,
  setInpiProcessActive,
  triageInpiDispatch,
  type InpiDeps,
} from "./service.js";

const addProcessSchema = z.object({
  processNumber: z.string().trim().min(9).max(20),
  label: z.string().trim().max(200).optional(),
  legalMatterId: z.string().uuid().optional(),
});
const addAttorneySchema = z.object({ attorneyName: z.string().trim().min(5).max(200) });
const activeSchema = z.object({ active: z.boolean() });
const runSchema = z.object({ edition: z.number().int().min(2000).max(99999).optional() });
const listSchema = z.object({
  status: z.enum(["new", "triaged", "dismissed"]).optional(),
  processNumber: z.string().max(20).optional(),
  page: z.coerce.number().int().min(1).optional(),
});
const triageSchema = z
  .object({
    createDeadline: z.boolean(),
    ruleDays: z.number().int().min(1).max(3650).optional(),
    createTask: z.boolean(),
  })
  .refine((v) => v.createDeadline || v.createTask, {
    message: "Crie ao menos um prazo ou uma tarefa, ou descarte o despacho.",
  });
const dismissSchema = z.object({ reason: z.string().trim().min(3).max(1000) });

type Params = { organizationId?: string; id?: string };

export async function registerInpiRoutes(app: FastifyInstance, deps: ApiDeps, inpi: InpiDeps) {
  const root = "/organizations/:organizationId/inpi";
  const org = (params: unknown) => parseInput(uuidSchema, (params as Params).organizationId);
  const id = (params: unknown) => parseInput(uuidSchema, (params as Params).id);

  app.get(`${root}/monitors`, async (request) => {
    const account = await requireAccount(deps, request);
    return listInpiMonitors(deps.db, account, org(request.params));
  });

  app.post(`${root}/processes`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(addProcessSchema, request.body);
    const result = await addInpiProcess(
      deps.db,
      account,
      org(request.params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${root}/processes/:id`, async (request) => {
    const account = await requireAccount(deps, request);
    const { active } = parseInput(activeSchema, request.body);
    return setInpiProcessActive(deps.db, account, org(request.params), id(request.params), active);
  });

  app.post(`${root}/attorneys`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(addAttorneySchema, request.body);
    const result = await addInpiAttorney(
      deps.db,
      account,
      org(request.params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${root}/attorneys/:id`, async (request) => {
    const account = await requireAccount(deps, request);
    const { active } = parseInput(activeSchema, request.body);
    return setInpiAttorneyActive(deps.db, account, org(request.params), id(request.params), active);
  });

  app.post(`${root}/run`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(runSchema, request.body ?? {});
    return runInpiNow(deps.db, inpi, account, org(request.params), input);
  });

  app.get(`${root}/dispatches`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(listSchema, request.query ?? {});
    return listInpiDispatches(deps.db, account, org(request.params), query);
  });

  app.post(`${root}/dispatches/:id/triage`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(triageSchema, request.body);
    return triageInpiDispatch(
      deps.db,
      account,
      org(request.params),
      id(request.params),
      input,
      meta(request),
    );
  });

  app.post(`${root}/dispatches/:id/dismiss`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(dismissSchema, request.body);
    return dismissInpiDispatch(
      deps.db,
      account,
      org(request.params),
      id(request.params),
      input,
      meta(request),
    );
  });
}
