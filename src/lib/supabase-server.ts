import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente sin cookies para operaciones background (fire-and-forget)
export function createServiceClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Cliente para uso en server (API routes, server components, middleware)
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll puede fallar en Server Components (read-only cookies).
          // Es seguro ignorar si el middleware refresca la sesión.
        }
      },
    },
  });
}
