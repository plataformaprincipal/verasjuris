import {
  createAssistantSessionSchema,
  parseInput,
  sendAssistantMessageSchema,
  updateAssistantConversationSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import { AssistantService } from "./service.js";
import type { AssistantToolName } from "./tool-registry.js";

export async function registerAssistantRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  const svc = () =>
    new AssistantService(deps.db, deps.aiGateway, { rateLimiter: deps.rateLimiter });

  const orgRoot = "/organizations/:organizationId/assistant";

  app.post(`${orgRoot}/conversations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    const body = parseInput(createAssistantSessionSchema, request.body ?? {});
    return reply
      .status(201)
      .send(await svc().createConversation(account, { ...body, organizationId }));
  });

  app.get(`${orgRoot}/conversations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    return reply.send(await svc().listConversations(account, organizationId));
  });

  app.get(`${orgRoot}/conversations/:conversationId/messages`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; conversationId?: string };
    parseInput(uuidSchema, params.organizationId);
    const conversationId = parseInput(uuidSchema, params.conversationId);
    return reply.send(await svc().getMessages(account, conversationId));
  });

  app.patch(`${orgRoot}/conversations/:conversationId`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; conversationId?: string };
    parseInput(uuidSchema, params.organizationId);
    const conversationId = parseInput(uuidSchema, params.conversationId);
    const body = parseInput(updateAssistantConversationSchema, request.body ?? {});
    return reply.send(await svc().updateConversation(account, conversationId, body));
  });

  app.delete(`${orgRoot}/conversations/:conversationId`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; conversationId?: string };
    parseInput(uuidSchema, params.organizationId);
    const conversationId = parseInput(uuidSchema, params.conversationId);
    return reply.send(await svc().deleteConversation(account, conversationId));
  });

  app.post(`${orgRoot}/messages`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(
      uuidSchema,
      (request.params as { organizationId?: string }).organizationId,
    );
    void organizationId;
    const body = parseInput(sendAssistantMessageSchema, request.body ?? {});
    return reply.status(201).send(await svc().sendMessage(account, body));
  });

  app.post(`${orgRoot}/tools/:tool`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; tool?: string };
    parseInput(uuidSchema, params.organizationId);
    const body = parseInput(
      z.object({
        conversationId: z.string().uuid(),
        params: z.record(z.unknown()).default({}),
      }),
      request.body ?? {},
    );
    return reply.send(
      await svc().invokeTool(
        account,
        body.conversationId,
        params.tool as AssistantToolName,
        body.params,
        meta(request),
      ),
    );
  });

  app.post(`${orgRoot}/feedback`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    parseInput(uuidSchema, (request.params as { organizationId?: string }).organizationId);
    const body = parseInput(
      z.object({
        conversationId: z.string().uuid().optional(),
        messageId: z.string().uuid().optional(),
        rating: z.enum(["positive", "negative", "neutral"]),
        comment: z.string().trim().max(2000).optional(),
      }),
      request.body ?? {},
    );
    return reply.status(201).send(await svc().feedback(account, body));
  });
}
