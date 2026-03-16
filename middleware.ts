import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Rate limiting — edge-side, in-memory sliding window
// Each edge instance tracks its own state. Not globally coordinated, but
// sufficient to cap runaway single-IP abuse and protect Bluesky's API.
// ---------------------------------------------------------------------------
const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 20  // per IP per window

const ipWindows = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const hits = (ipWindows.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  if (hits.length >= MAX_REQUESTS) return true
  hits.push(now)
  ipWindows.set(ip, hits)
  return false
}

// ---------------------------------------------------------------------------
// Terminal-client detection (curl, wget, etc.)
// ---------------------------------------------------------------------------
function isTerminalClient(req: NextRequest): boolean {
  const ua = req.headers.get('user-agent') ?? ''
  const accept = req.headers.get('accept') ?? ''

  if (/^(curl|Wget|HTTPie|httpie|xh\/|python-httpx|python-requests|Go-http-client|nushell|Nu\/|httpx\/)/i.test(ua)) {
    return true
  }
  if (/^text\/(markdown|plain)/.test(accept)) return true
  if (ua && !ua.includes('Mozilla') && !accept.includes('text/html')) {
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Terminal rewrite on homepage
  if (pathname === '/' && isTerminalClient(req)) {
    const url = req.nextUrl.clone()
    url.pathname = '/cli'
    return NextResponse.rewrite(url)
  }

  // Rate-limit API routes
  if (pathname.startsWith('/profile') || pathname === '/search' || pathname === '/trending') {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (isRateLimited(ip)) {
      return new NextResponse('Rate limit exceeded. Please slow down.\n', {
        status: 429,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Retry-After': '60',
        },
      })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/profile/:path*', '/search', '/trending'],
}
