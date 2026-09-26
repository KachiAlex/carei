import { z } from 'zod'

export { z }

/**
 * Parse a request body against a zod schema.
 * Returns { data } on success or { error } with a readable message.
 * (Flat shape — this codebase compiles with strict:false, so
 * discriminated-union narrowing is unreliable here.)
 */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): { data?: T; error?: string } {
  const result = schema.safeParse(body ?? {})
  if (result.success) return { data: result.data }
  const first = result.error.issues[0]
  const path = first.path.join('.') || 'body'
  return { error: `${path}: ${first.message}` }
}
