import { type NextRequest } from 'next/server'
import { getFollowing } from '@/lib/bsky'
import { renderFollowing } from '@/lib/markdown'
import { markdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  return handleRoute(async () => {
    const { handle } = await params
    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)

    const page = await getFollowing(handle, cursor, limit)
    const md = renderFollowing(handle, page, baseUrl(req))
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
