import { type NextRequest, NextResponse } from 'next/server'
import { getReplies } from '@/lib/bsky'
import { renderReplies } from '@/lib/markdown'
import { markdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'
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
        const targetPath = `${redirectPath}/replies`
        const newUrl = new URL(targetPath, baseUrl(req))
        req.nextUrl.searchParams.forEach((value, key) => {
          newUrl.searchParams.set(key, value)
        })
        return NextResponse.redirect(newUrl)
      }
    }

    const searchParams = req.nextUrl.searchParams
    const cursor = searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

    const { root, replies } = await getReplies(handle, rkey)
    const md = renderReplies(handle, rkey, root, replies, baseUrl(req), limit, cursor)
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
