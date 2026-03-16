const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
}

// Default: profiles, lists, search — fresh for 2 min, stale-serve for 1 hr
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=3600',
}

// Posts and threads are immutable — cache aggressively
const IMMUTABLE_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
}

export function markdownResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      ...CORS_HEADERS,
      ...CACHE_HEADERS,
    },
  })
}

export function immutableMarkdownResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      ...CORS_HEADERS,
      ...IMMUTABLE_CACHE_HEADERS,
    },
  })
}

export function errorResponse(message: string, status = 500): Response {
  return new Response(`Error: ${message}\n`, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...CORS_HEADERS,
    },
  })
}

export function optionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

/**
 * Extract the base URL of the current request (scheme + host, no trailing
 * slash) so we can generate fully-qualified links in markdown output.
 */
export function baseUrl(req: Request): string {
  const url = new URL(req.url)
  return `${url.protocol}//${url.host}`
}

/**
 * Wrap a route handler with consistent error handling.
 * Maps Bluesky API errors to appropriate HTTP responses.
 * Auth-required accounts get a friendly markdown notice instead of a raw error.
 */
export async function handleRoute(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn()
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; error?: string }
    const message = e?.message ?? 'An unexpected error occurred'
    let status = e?.status ?? 500

    // Account requires sign-in — return a helpful markdown notice
    if (
      status === 401 ||
      e?.error === 'AuthRequired' ||
      /auth(entication)? required/i.test(message)
    ) {
      const body = `# 🔒 Sign-in required

This Bluesky account has enabled **"Require sign-in to view"** in their privacy settings.

bsky.md only has access to public content and cannot fetch posts from accounts that require authentication.

You can view their profile directly on Bluesky:
https://bsky.app

> **Note:** This is a privacy choice made by the account holder, not an error with bsky.md.
`
      return new Response(body, {
        status: 403,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          ...CORS_HEADERS,
        },
      })
    }

    // Bluesky returns 400 InvalidRequest for most "not found" cases.
    if (
      status === 400 &&
      (e?.error === 'InvalidRequest' || e?.error === 'NotFound') &&
      /not found/i.test(message)
    ) {
      status = 404
    }

    return errorResponse(message, status)
  }
}
