#!/usr/bin/env node
/**
 * Provisiona convite SUPER_ADMIN de uso único para acesseverasjuris@gmail.com.
 *
 * - Não imprime nem grava senhas.
 * - Token em claro aparece UMA vez no stdout; só o hash vai ao banco.
 * - Idempotente se já existir SUPER_ADMIN ativo ou convite pendente válido.
 *
 * Uso (com DATABASE_URL e migration 0026 aplicada):
 *   node scripts/provision-platform-super-admin-invite.mjs
 *
 * Opcional: PLATFORM_BOOTSTRAP_EMAIL=outro@dominio.com
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

Object.assign(process.env, loadEnv(resolve(process.cwd(), ".env")));

const email = (process.env.PLATFORM_BOOTSTRAP_EMAIL || "acesseverasjuris@gmail.com")
  .trim()
  .toLowerCase();
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "DATABASE_URL ausente. Configure o banco e aplique a migration 0026 antes.",
    }),
  );
  process.exit(1);
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

const { default: postgres } = await import("postgres");
const sql = postgres(databaseUrl, { max: 1 });

try {
  const active = await sql`
    select id from platform_staff
    where role_key = 'SUPER_ADMIN' and status = 'active'
    limit 1
  `;
  if (active.length > 0) {
    console.log(
      JSON.stringify({
        ok: true,
        created: false,
        reason: "already_has_active_super_admin",
        email,
      }),
    );
    process.exit(0);
  }

  const pending = await sql`
    select id, expires_at from platform_admin_invites
    where email = ${email}
      and role_key = 'SUPER_ADMIN'
      and status = 'pending'
      and expires_at > now()
    order by created_at desc
    limit 1
  `;
  if (pending.length > 0) {
    console.log(
      JSON.stringify({
        ok: true,
        created: false,
        reason: "pending_invite_exists",
        inviteId: pending[0].id,
        email,
        hint: "Revogue o convite pendente no banco se precisar reemitir o token.",
      }),
    );
    process.exit(0);
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const rows = await sql`
    insert into platform_admin_invites (
      email, role_key, token_hash, status, expires_at, note
    ) values (
      ${email},
      'SUPER_ADMIN',
      ${tokenHash},
      'pending',
      now() + interval '7 days',
      'Bootstrap SUPER_ADMIN inicial'
    )
    returning id, expires_at
  `;

  console.log(
    JSON.stringify(
      {
        ok: true,
        created: true,
        email,
        inviteId: rows[0].id,
        expiresAt: rows[0].expires_at,
        activationPath: `/admin/ativar?token=${token}`,
        warning:
          "Guarde o activationPath agora. O token não será exibido novamente e não está no banco.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const missingTable = /platform_admin_invites|platform_staff|does not exist/i.test(message);
  console.error(
    JSON.stringify({
      ok: false,
      error: missingTable
        ? "Tabelas de platform admin ausentes. Aplique a migration 0026_platform_admin.sql com backup."
        : "Falha ao provisionar convite (detalhe omitido se sensível).",
      code: missingTable ? "MIGRATION_PENDING" : "PROVISION_FAILED",
    }),
  );
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
