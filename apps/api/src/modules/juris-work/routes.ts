import { parseInput, uuidSchema } from "@verasjuris/validation";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  approveJurisWorkStep,
  approveJurisWorkTask,
  cancelJurisWorkTask,
  createJurisWorkTask,
  getJurisWorkTask,
  listJurisWorkTasks,
  runNextJurisWorkStep,
} from "./service.js";

const createSchema = z.object({
  title: z.string().trim().min(3).max(180),
  objective: z.string().trim().min(10).max(4000),
  budgetMicros: z.number().int().min(10_000).max(50_000_000).optional(),
  maxSteps: z.number().int().min(1).max(12).optional(),
});

type Params = {
  organizationId?: string;
  taskId?: string;
  stepId?: string;
};

export async function registerJurisWorkRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId/juris-work";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);

  app.get(root, async (request) => {
    const account = await requireAccount(deps, request);
    return listJurisWorkTasks(deps.db, account, org(request.params as Params));
  });

  app.post(root, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createSchema, request.body);
    const result = await createJurisWorkTask(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/:taskId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getJurisWorkTask(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.taskId),
    );
  });

  app.post(`${root}/:taskId/approve`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return approveJurisWorkTask(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.taskId),
      meta(request),
    );
  });

  app.post(`${root}/:taskId/run-next`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return runNextJurisWorkStep(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.taskId),
      meta(request),
    );
  });

  app.post(`${root}/:taskId/steps/:stepId/approve`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return approveJurisWorkStep(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.taskId),
      parseInput(uuidSchema, params.stepId),
      meta(request),
    );
  });

  app.post(`${root}/:taskId/cancel`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return cancelJurisWorkTask(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.taskId),
      meta(request),
    );
  });
}
