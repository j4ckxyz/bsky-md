import { type NextRequest, NextResponse } from 'next/server'
import { getThread } from '@/lib/bsky'
import { renderThread } from '@/lib/markdown'
import { immutableMarkdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'
import { isAtUri, redirectPathForAtUri } from '@/lib/at-uri'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string; rkey: string }> },
) {
  return handleRoute(async () => {
    const { handle, rkey } = await params

    // If handle is an AT URI, redirect to correct parsed path
    if (isAtUri(handle)) {
      const redirectPath = redirectPathForAtUri(handle)
      if (redirectPath) {
        return NextResponse.redirect(new URL(redirectPath, baseUrl(req)))
      }
    }

    const full = req.nextUrl.searchParams.get('full') === 'true'
    const thread = await getThread(handle, rkey, full)
    const md = renderThread(thread, baseUrl(req))
    return immutableMarkdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
