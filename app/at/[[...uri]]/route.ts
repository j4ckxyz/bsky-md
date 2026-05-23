import { type NextRequest, NextResponse } from 'next/server'
import { redirectPathForAtUri } from '@/lib/at-uri'
import { baseUrl } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uri?: string[] }> },
) {
  const { uri } = await params
  const searchParams = req.nextUrl.searchParams
  const queryUri = searchParams.get('uri') || searchParams.get('q')
  
  let targetUri = ''
  if (queryUri) {
    targetUri = queryUri
  } else if (uri && uri.length > 0) {
    let segments = [...uri]
    if (segments[0] === 'at:') {
      segments.shift()
    }
    targetUri = `at://${segments.join('/')}`
  }
  
  if (!targetUri) {
    return new NextResponse('Error: Missing AT URI\n', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  
  const redirectPath = redirectPathForAtUri(targetUri)
  if (redirectPath) {
    const base = baseUrl(req)
    const newUrl = new URL(redirectPath, base)
    searchParams.forEach((value, key) => {
      if (key !== 'uri' && key !== 'q') {
        newUrl.searchParams.set(key, value)
      }
    })
    return NextResponse.redirect(newUrl)
  }
  
  return new NextResponse('Error: Invalid or unsupported AT URI\n', {
    status: 400,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}
