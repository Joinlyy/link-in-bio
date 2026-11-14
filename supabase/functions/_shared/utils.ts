import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
}

/** Sites allowed to call the functions from a browser: APP_ORIGIN with and without www, any extra
 *  comma-separated APP_ORIGINS, and local development. */
const ALLOWED_ORIGINS = (() => {
  const set = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'])
  const add = (o: string) => {
    try {
      const u = new URL(o.trim())
      set.add(u.origin)
      const twin = u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`
      set.add(`${u.protocol}//${twin}${u.port ? `:${u.port}` : ''}`)
    } catch {
      // ignore malformed values
    }
  }
  const main = Deno.env.get('APP_ORIGIN')
  if (main) add(main)
  for (const o of (Deno.env.get('APP_ORIGINS') ?? '').split(',')) if (o.trim()) add(o)
  return set
})()

/** The Access-Control-Allow-Origin value for this request. With anyOrigin (functions authorised by a
 *  token in the body, e.g. downloads on creators' custom domains) every site may call. */
function allowOrigin(req: Request, anyOrigin: boolean) {
  const origin = req.headers.get('Origin')
  if (anyOrigin) return origin || '*'
  if (origin && ALLOWED_ORIGINS.has(origin)) return origin
  return corsHeaders['Access-Control-Allow-Origin']
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

export function handle(fn: (req: Request) => Promise<Response>, opts: { anyOrigin?: boolean } = {}) {
  return async (req: Request) => {
    const origin = allowOrigin(req, Boolean(opts.anyOrigin))
    if (req.method === 'OPTIONS') return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Origin': origin } })
    let res: Response
    try {
      res = await fn(req)
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      if (status === 500) {
        // The detail goes to the function logs only: database and auth errors can name tables and columns
        console.error(err)
        res = json({ error: 'Something went wrong. Please try again.' }, 500)
      } else {
        res = json({ error: err instanceof Error ? err.message : 'Unexpected error' }, status)
      }
    }
    try {
      res.headers.set('Access-Control-Allow-Origin', origin)
      res.headers.set('Vary', 'Origin')
    } catch {
      // immutable headers (a proxied response): leave as is
    }
    return res
  }
}
