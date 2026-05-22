import { type NextRequest } from 'next/server'
import { getPost } from '@/lib/bsky'
import { renderPost } from '@/lib/markdown'
import { immutableMarkdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string; rkey: string }> },
) {
  return handleRoute(async () => {
    const { handle, rkey } = await params
    const post = await getPost(handle, rkey)
    if (post.isReply) {
      const { getThread } = await import('@/lib/bsky')
      const { renderThread } = await import('@/lib/markdown')
      const thread = await getThread(handle, rkey)
      const md = renderThread(thread, baseUrl(req))
      return immutableMarkdownResponse(md)
    }
    const md = renderPost(post, baseUrl(req))
    return immutableMarkdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
