import { type NextRequest } from 'next/server'
import { getAlsoLiked } from '@/lib/bsky'
import { renderAlsoLiked } from '@/lib/markdown'
import { immutableMarkdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string; rkey: string }> },
) {
  return handleRoute(async () => {
    const { handle, rkey } = await params
    const posts = await getAlsoLiked(handle, rkey)
    const md = renderAlsoLiked(handle, rkey, posts, baseUrl(req))
    return immutableMarkdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
