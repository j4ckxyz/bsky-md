import { NextRequest, NextResponse } from 'next/server'

function isTerminalClient(req: NextRequest): boolean {
  const ua = req.headers.get('user-agent') ?? ''
  const accept = req.headers.get('accept') ?? ''

  // Known terminal / CLI clients
  if (/^(curl|Wget|HTTPie|httpie|xh\/|python-httpx|python-requests|Go-http-client|nushell|Nu\/|httpx\/)/i.test(ua)) {
    return true
  }

  // Anything that explicitly accepts text/markdown or text/plain first
  if (/^text\/(markdown|plain)/.test(accept)) return true

  // No Mozilla = definitely not a browser
  // (every real browser sends "Mozilla/5.0 ...")
  if (ua && !ua.includes('Mozilla') && !accept.includes('text/html')) {
    return true
  }

  return false
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/' && isTerminalClient(req)) {
    const url = req.nextUrl.clone()
    url.pathname = '/cli'
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/',
}
