import { type NextRequest } from 'next/server'
import { searchPosts } from '@/lib/bsky'
import { renderSearch } from '@/lib/markdown'
import { markdownResponse, errorResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const url = new URL(req.url)
    const query = url.searchParams.get('q')

    if (!query?.trim()) {
      return errorResponse('Missing required query parameter: q', 400)
    }

    const cursor = url.searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100)

    const page = await searchPosts(query, cursor, limit)
    const md = renderSearch(query, page, baseUrl(req))
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
