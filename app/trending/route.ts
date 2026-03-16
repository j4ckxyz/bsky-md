import { type NextRequest } from 'next/server'
import { getTrending } from '@/lib/bsky'
import { renderTrending } from '@/lib/markdown'
import { markdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const data = await getTrending()
    const md = renderTrending(data, baseUrl(req))
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
