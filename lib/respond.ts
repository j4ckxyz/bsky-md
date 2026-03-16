const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
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
 * Maps Bluesky API 400 "not found" errors to HTTP 404.
 */
export async function handleRoute(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn()
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number; error?: string }
    const message = e?.message ?? 'An unexpected error occurred'

    // Bluesky returns 400 InvalidRequest for most "not found" cases.
    // Map those to 404 so clients can distinguish missing resources from bad requests.
    let status = e?.status ?? 500
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
