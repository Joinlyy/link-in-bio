import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Resolve the calling user from the Authorization bearer token. */
export async function requireUser(req: Request, admin: SupabaseClient): Promise<User> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Not signed in')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Session expired, please sign in again')
  return data.user
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
      return await fn(req)
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      if (status === 500) {
        // The detail goes to the function logs only: database and auth errors can name tables and columns
        console.error(err)
        return json({ error: 'Something went wrong. Please try again.' }, 500)
      }
      return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, status)
    }
  }
}
