import { type NextRequest, NextResponse } from 'next/server'
import { isAtUri, redirectPathForAtUri } from '@/lib/at-uri'
import { baseUrl } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ rkey: string }> },
) {
  const { rkey } = await params
  
  const decodedRkey = decodeURIComponent(rkey)
  if (isAtUri(decodedRkey)) {
    const redirectPath = redirectPathForAtUri(decodedRkey)
    if (redirectPath) {
      return NextResponse.redirect(new URL(redirectPath, baseUrl(req)))
    }
  }
  
  const searchParams = req.nextUrl.searchParams
  const uri = searchParams.get('uri')
  if (uri && isAtUri(uri)) {
    const redirectPath = redirectPathForAtUri(uri)
    if (redirectPath) {
      return NextResponse.redirect(new URL(redirectPath, baseUrl(req)))
    }
  }
  
  return new NextResponse('Error: Starter pack endpoint requires a full at:// URI or /profile/:handle/starter-pack/:rkey format.\n', {
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
