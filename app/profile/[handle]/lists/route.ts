import { type NextRequest } from 'next/server'
import { getActorLists } from '@/lib/bsky'
import { renderActorLists } from '@/lib/markdown'
import { markdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  return handleRoute(async () => {
    const { handle } = await params
    const searchParams = req.nextUrl.searchParams
    const cursor = searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    
    const page = await getActorLists(handle, cursor, limit)
    const md = renderActorLists(handle, page, baseUrl(req))
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
