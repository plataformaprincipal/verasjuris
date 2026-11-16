import {
  isUniqueViolation,
  jurisWorkCreditBalances,
  jurisWorkCreditLedger,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
type Db = AppDatabase | DbTx;

const INITIAL_GRANT_AMOUNT = 5;

export function initialWorkCreditsIdempotencyKey(organizationId: string, userId: string): string {
  return `work-credits:initial:${organizationId}:${userId}`;
}

export function reserveWorkCreditIdempotencyKey(taskId: string): string {
  return `work-reserve:${taskId}`;
}

export function consumeWorkCreditIdempotencyKey(taskId: string): string {
  return `work-consume:${taskId}`;
}

export function releaseWorkCreditIdempotencyKey(taskId: string): string {
  return `work-release:${taskId}`;
}

function serializeBalance(row: typeof jurisWorkCreditBalances.$inferSelect) {
  return {
    balance: row.balance,
    lifetimeGranted: row.lifetimeGranted,
    organizationId: row.organizationId,
    userId: row.userId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureBalanceRow(
  db: Db,
  organizationId: string,
  userId: string,
): Promise<typeof jurisWorkCreditBalances.$inferSelect> {
  await db
    .insert(jurisWorkCreditBalances)
    .values({
      organizationId,
      userId,
      balance: 0,
      lifetimeGranted: 0,
    })
    .onConflictDoNothing({
      target: [jurisWorkCreditBalances.organizationId, jurisWorkCreditBalances.userId],
    });

  const [row] = await db
    .select()
    .from(jurisWorkCreditBalances)
    .where(
      and(
        eq(jurisWorkCreditBalances.organizationId, organizationId),
        eq(jurisWorkCreditBalances.userId, userId),
      ),
    )
    .for("update")
    .limit(1);

  if (!row) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível obter o saldo de créditos Work.");
  }
  return row;
}

async function findLedgerByIdempotency(db: Db, idempotencyKey: string) {
  return db.query.jurisWorkCreditLedger.findFirst({
    where: eq(jurisWorkCreditLedger.idempotencyKey, idempotencyKey),
  });
}

/**
 * Concede créditos iniciais uma vez por org+usuário (idempotente no login/uso).
 * Chave padrão: work-credits:initial:${org}:${user}
 */
export async function ensureInitialWorkCredits(
  db: AppDatabase,
  input: {
    organizationId: string;
    userId: string;
    grantAmount?: number;
    idempotencyKey?: string;
    actorUserId?: string;
  },
) {
  const grantAmount = input.grantAmount ?? INITIAL_GRANT_AMOUNT;
  const idempotencyKey =
    input.idempotencyKey ??
    initialWorkCreditsIdempotencyKey(input.organizationId, input.userId);

  return db.transaction(async (tx) => {
    const existing = await findLedgerByIdempotency(tx, idempotencyKey);
    if (existing) {
      const balance = await ensureBalanceRow(tx, input.organizationId, input.userId);
      return {
        granted: false as const,
        credits: serializeBalance(balance),
        ledgerEventId: existing.id,
      };
    }

    const balance = await ensureBalanceRow(tx, input.organizationId, input.userId);
    const now = new Date();
    const nextBalance = balance.balance + grantAmount;
    const nextLifetime = balance.lifetimeGranted + grantAmount;

    try {
      const [ledger] = await tx
        .insert(jurisWorkCreditLedger)
        .values({
          organizationId: input.organizationId,
          userId: input.userId,
          eventType: "granted",
          direction: "credit",
          quantity: grantAmount,
          reason: "Créditos iniciais JurisOne Work",
          idempotencyKey,
          actorUserId: input.actorUserId ?? input.userId,
          metadata: { source: "ensure_initial" },
        })
        .returning();

      const [updated] = await tx
        .update(jurisWorkCreditBalances)
        .set({
          balance: nextBalance,
          lifetimeGranted: nextLifetime,
          updatedAt: now,
        })
        .where(eq(jurisWorkCreditBalances.id, balance.id))
        .returning();

      return {
        granted: true as const,
        credits: serializeBalance(updated!),
        ledgerEventId: ledger!.id,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await findLedgerByIdempotency(tx, idempotencyKey);
        const current = await ensureBalanceRow(tx, input.organizationId, input.userId);
        return {
          granted: false as const,
          credits: serializeBalance(current),
          ledgerEventId: raced?.id ?? null,
        };
      }
      throw error;
    }
  });
}

export async function getWorkCreditBalance(
  db: AppDatabase,
  organizationId: string,
  userId: string,
) {
  const row = await db.query.jurisWorkCreditBalances.findFirst({
    where: and(
      eq(jurisWorkCreditBalances.organizationId, organizationId),
      eq(jurisWorkCreditBalances.userId, userId),
    ),
  });
  if (!row) {
    return { balance: 0, lifetimeGranted: 0, organizationId, userId, updatedAt: null as string | null };
  }
  return serializeBalance(row);
}

export async function listWorkCreditLedger(
  db: AppDatabase,
  organizationId: string,
  userId: string,
  limit = 50,
) {
  const items = await db.query.jurisWorkCreditLedger.findMany({
    where: and(
      eq(jurisWorkCreditLedger.organizationId, organizationId),
      eq(jurisWorkCreditLedger.userId, userId),
    ),
    orderBy: [desc(jurisWorkCreditLedger.createdAt)],
    limit,
  });
  return {
    items: items.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      direction: row.direction,
      quantity: row.quantity,
      reason: row.reason,
      taskId: row.taskId,
      idempotencyKey: row.idempotencyKey,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

/**
 * Reserva 1 crédito para uma tarefa (débito imediato do saldo).
 * Idempotente por idempotencyKey (tipicamente work-reserve:${taskId}).
 */
export async function reserveWorkCredit(
  db: AppDatabase,
  input: {
    organizationId: string;
    userId: string;
    taskId: string;
    idempotencyKey: string;
    actorUserId?: string;
  },
) {
  return db.transaction(async (tx) => {
    const existing = await findLedgerByIdempotency(tx, input.idempotencyKey);
    if (existing) {
      const balance = await ensureBalanceRow(tx, input.organizationId, input.userId);
      return {
        reserved: false as const,
        alreadyApplied: true as const,
        credits: serializeBalance(balance),
        ledgerEventId: existing.id,
      };
    }

    const balance = await ensureBalanceRow(tx, input.organizationId, input.userId);
    if (balance.balance < 1) {
      throw new AppError(
        "CONFLICT",
        "Créditos Work insuficientes. Aguarde liberação ou solicite novos créditos.",
      );
    }

    const now = new Date();
    try {
      const [ledger] = await tx
        .insert(jurisWorkCreditLedger)
        .values({
          organizationId: input.organizationId,
          userId: input.userId,
          taskId: input.taskId,
          eventType: "reserved",
          direction: "debit",
          quantity: 1,
          reason: "Reserva de crédito para tarefa Work",
          idempotencyKey: input.idempotencyKey,
          actorUserId: input.actorUserId ?? input.userId,
          metadata: { taskId: input.taskId },
        })
        .returning();

      const [updated] = await tx
        .update(jurisWorkCreditBalances)
        .set({ balance: balance.balance - 1, updatedAt: now })
        .where(eq(jurisWorkCreditBalances.id, balance.id))
        .returning();

      return {
        reserved: true as const,
        alreadyApplied: false as const,
        credits: serializeBalance(updated!),
        ledgerEventId: ledger!.id,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await findLedgerByIdempotency(tx, input.idempotencyKey);
        const current = await ensureBalanceRow(tx, input.organizationId, input.userId);
        return {
          reserved: false as const,
          alreadyApplied: true as const,
          credits: serializeBalance(current),
          ledgerEventId: raced?.id ?? null,
        };
      }
      throw error;
    }
  });
}

/**
 * Converte reserva → consumo. O saldo já foi debitado no reserve;
 * aqui apenas registra o evento consumed (sem reembolso).
 * Usar após trabalho significativo iniciado — não reembolsar.
 */
export async function consumeReservedCredit(
  db: AppDatabase,
  input: {
    organizationId: string;
    userId: string;
    taskId: string;
    idempotencyKey?: string;
    actorUserId?: string;
  },
) {
  const idempotencyKey =
    input.idempotencyKey ?? consumeWorkCreditIdempotencyKey(input.taskId);

  return db.transaction(async (tx) => {
    const existing = await findLedgerByIdempotency(tx, idempotencyKey);
    if (existing) {
      const balance = await ensureBalanceRow(tx, input.organizationId, input.userId);
      return {
        consumed: false as const,
        alreadyApplied: true as const,
        credits: serializeBalance(balance),
        ledgerEventId: existing.id,
      };
    }

    const reserved = await findLedgerByIdempotency(
      tx,
      reserveWorkCreditIdempotencyKey(input.taskId),
    );
    if (!reserved || reserved.eventType !== "reserved") {
      throw new AppError(
        "CONFLICT",
        "Não há crédito reservado para esta tarefa Work.",
      );
    }

    const released = await findLedgerByIdempotency(
      tx,
      releaseWorkCreditIdempotencyKey(input.taskId),
    );
    if (released) {
      throw new AppError(
        "CONFLICT",
        "O crédito desta tarefa já foi liberado; não pode ser consumido.",
      );
    }

    const balance = await ensureBalanceRow(tx, input.organizationId, input.userId);
    try {
      const [ledger] = await tx
        .insert(jurisWorkCreditLedger)
        .values({
          organizationId: input.organizationId,
          userId: input.userId,
          taskId: input.taskId,
          eventType: "consumed",
          direction: "debit",
          quantity: 1,
          reason: "Consumo de crédito após execução Work",
          idempotencyKey,
          actorUserId: input.actorUserId ?? input.userId,
          metadata: {
            taskId: input.taskId,
            note: "Saldo já debitado na reserva; sem reembolso após trabalho significativo.",
          },
        })
        .returning();

      return {
        consumed: true as const,
        alreadyApplied: false as const,
        credits: serializeBalance(balance),
        ledgerEventId: ledger!.id,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await findLedgerByIdempotency(tx, idempotencyKey);
        return {
          consumed: false as const,
          alreadyApplied: true as const,
          credits: serializeBalance(balance),
          ledgerEventId: raced?.id ?? null,
        };
      }
      throw error;
    }
  });
}

/**
 * Libera crédito reservado (reembolso) se a tarefa falhou/cancelou antes de
 * trabalho significativo. Credita o saldo de volta.
 */
export async function releaseReservedCredit(
  db: AppDatabase,
  input: {
    organizationId: string;
    userId: string;
    taskId: string;
    idempotencyKey?: string;
    actorUserId?: string;
    reason?: string;
  },
) {
  const idempotencyKey =
    input.idempotencyKey ?? releaseWorkCreditIdempotencyKey(input.taskId);

  return db.transaction(async (tx) => {
    const existing = await findLedgerByIdempotency(tx, idempotencyKey);
    if (existing) {
      const balance = await ensureBalanceRow(tx, input.organizationId, input.userId);
      return {
        released: false as const,
        alreadyApplied: true as const,
        credits: serializeBalance(balance),
        ledgerEventId: existing.id,
      };
    }

    const reserved = await findLedgerByIdempotency(
      tx,
      reserveWorkCreditIdempotencyKey(input.taskId),
    );
    if (!reserved || reserved.eventType !== "reserved") {
      // Sem reserva — nada a liberar (idempotente / safe no-op).
      const balance = await ensureBalanceRow(tx, input.organizationId, input.userId);
      return {
        released: false as const,
        alreadyApplied: false as const,
        credits: serializeBalance(balance),
        ledgerEventId: null,
      };
    }

    const consumed = await findLedgerByIdempotency(
      tx,
      consumeWorkCreditIdempotencyKey(input.taskId),
    );
    if (consumed) {
      throw new AppError(
        "CONFLICT",
        "O crédito desta tarefa já foi consumido; não pode ser liberado.",
      );
    }

    const balance = await ensureBalanceRow(tx, input.organizationId, input.userId);
    const now = new Date();
    try {
      const [ledger] = await tx
        .insert(jurisWorkCreditLedger)
        .values({
          organizationId: input.organizationId,
          userId: input.userId,
          taskId: input.taskId,
          eventType: "released",
          direction: "credit",
          quantity: 1,
          reason: input.reason ?? "Liberação de crédito (cancelamento antes da execução)",
          idempotencyKey,
          actorUserId: input.actorUserId ?? input.userId,
          metadata: { taskId: input.taskId },
        })
        .returning();

      const [updated] = await tx
        .update(jurisWorkCreditBalances)
        .set({ balance: balance.balance + 1, updatedAt: now })
        .where(eq(jurisWorkCreditBalances.id, balance.id))
        .returning();

      return {
        released: true as const,
        alreadyApplied: false as const,
        credits: serializeBalance(updated!),
        ledgerEventId: ledger!.id,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await findLedgerByIdempotency(tx, idempotencyKey);
        const current = await ensureBalanceRow(tx, input.organizationId, input.userId);
        return {
          released: false as const,
          alreadyApplied: true as const,
          credits: serializeBalance(current),
          ledgerEventId: raced?.id ?? null,
        };
      }
      throw error;
    }
  });
}
