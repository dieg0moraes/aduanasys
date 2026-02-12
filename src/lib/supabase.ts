import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Para el MVP usamos tipado genérico. En producción, generar tipos con:
// npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any;

// Cliente para uso en el browser (componentes client)
export const supabase = createClient<AnyDB>(supabaseUrl, supabaseAnonKey);

// Cliente para uso en server (API routes, server components)
export function createServerClient() {
  return createClient<AnyDB>(supabaseUrl, supabaseAnonKey);
}
