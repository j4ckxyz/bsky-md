import { type NextRequest } from 'next/server'
import { getLikes } from '@/lib/bsky'
import { renderLikes } from '@/lib/markdown'
import { markdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  return handleRoute(async () => {
    const { handle } = await params
    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100)

    const page = await getLikes(handle, cursor, limit)
    const md = renderLikes(handle, page, baseUrl(req))
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
