import { parseInput, jurisOnePublicChatSchema } from "@verasjuris/validation";
import { AppError } from "@verasjuris/types";
import type { FastifyInstance } from "fastify";
import type { ApiDeps } from "../auth/routes.js";
import { publicJurisOneChat } from "./service.js";

export async function registerJurisOnePublicRoutes(
  app: FastifyInstance,
  deps: ApiDeps,
): Promise<void> {
  app.get("/juris-one/public/status", async () => {
    const gateway = deps.aiGateway;
    if (!gateway) {
      return {
        status: "not_configured",
        provider: null,
        detail: "Gateway de IA não inicializado.",
      };
    }
    const description = gateway.describe();
    const health = await gateway.healthCheck();
    return {
      status: description.status,
      provider: description.provider,
      health: health.status,
      detail: health.detail ?? null,
      publicChat: {
        dailyLimit: 5,
        maxMessageChars: 2_000,
      },
    };
  });

  app.post("/juris-one/public/chat", async (request, reply) => {
    if (!deps.aiGateway) {
      throw new AppError(
        "AI_PROVIDER_NOT_CONFIGURED",
        "O serviço de inteligência artificial está temporariamente indisponível.",
      );
    }
    const body = parseInput(jurisOnePublicChatSchema, request.body ?? {});
    const result = await publicJurisOneChat(
      { gateway: deps.aiGateway, rateLimiter: deps.rateLimiter },
      {
        message: body.message,
        locale: body.locale,
        visitorId: body.visitorId,
        history: body.history,
        ip: request.ip ?? "unknown",
      },
    );
    return reply.status(201).send(result);
  });
}
