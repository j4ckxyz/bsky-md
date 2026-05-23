import { type NextRequest } from 'next/server'
import { getQuotes } from '@/lib/bsky'
import { renderQuotes } from '@/lib/markdown'
import { markdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string; rkey: string }> },
) {
  return handleRoute(async () => {
    const { handle, rkey } = await params
    const searchParams = req.nextUrl.searchParams
    const cursor = searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
    
    const page = await getQuotes(handle, rkey, cursor, limit)
    const md = renderQuotes(handle, rkey, page, baseUrl(req))
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
