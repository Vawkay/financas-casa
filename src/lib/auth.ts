import { createClient } from "@/lib/supabase/server";

/**
 * Lista de e-mails autorizados a usar o app (separados por vírgula em
 * ALLOWED_EMAILS). App single-user, mas permite liberar a Katia no futuro.
 */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = allowedEmails();
  // Se a allowlist estiver vazia, não bloqueia (útil em dev).
  if (list.length === 0) return true;
  return list.includes(email.toLowerCase());
}

/** Retorna o usuário autenticado (server-side) ou null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Garante um usuário autenticado e autorizado; lança caso contrário. */
export async function requireUser() {
  const user = await getUser();
  if (!user || !isEmailAllowed(user.email)) {
    throw new Error("Não autorizado");
  }
  return user;
}
