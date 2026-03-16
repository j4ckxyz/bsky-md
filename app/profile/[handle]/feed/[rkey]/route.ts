import { type NextRequest } from 'next/server'
import { getCustomFeed } from '@/lib/bsky'
import { renderCustomFeed } from '@/lib/markdown'
import { markdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string; rkey: string }> },
) {
  return handleRoute(async () => {
    const { handle, rkey } = await params
    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100)

    const page = await getCustomFeed(handle, rkey, cursor, limit)
    const md = renderCustomFeed(handle, rkey, page, baseUrl(req))
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
