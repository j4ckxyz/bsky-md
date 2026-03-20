import { type NextRequest } from 'next/server'
import { searchPostsByUrl } from '@/lib/bsky'
import { renderLinks } from '@/lib/markdown'
import { markdownResponse, errorResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const reqUrl = new URL(req.url)
    const url = reqUrl.searchParams.get('url')

    if (!url?.trim()) {
      return errorResponse('Missing required query parameter: url', 400)
    }

    const cursor = reqUrl.searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(reqUrl.searchParams.get('limit') ?? '50', 10), 100)

    const page = await searchPostsByUrl(url, cursor, limit)
    const md = renderLinks(url, page, baseUrl(req))
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
