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
    const searchParams = req.nextUrl.searchParams
    const isSingle = searchParams.get('single') === 'true' || searchParams.get('thread') === 'false'

    if (post.isReply && !isSingle) {
      const { getThread } = await import('@/lib/bsky')
      const { renderThread } = await import('@/lib/markdown')
      const thread = await getThread(handle, rkey)
      const md = renderThread(thread, baseUrl(req))
      return immutableMarkdownResponse(md)
    }
    
    let md = renderPost(post, baseUrl(req))
    
    const showAlsoLiked = searchParams.get('also-liked') === 'true' || searchParams.get('alsoLiked') === 'true'
    if (showAlsoLiked) {
      const { getAlsoLiked } = await import('@/lib/bsky')
      const { renderAlsoLikedSection } = await import('@/lib/markdown')
      const alsoLikedPosts = await getAlsoLiked(handle, rkey)
      const alsoLikedMd = renderAlsoLikedSection(alsoLikedPosts, baseUrl(req))
      if (alsoLikedMd) {
        md += '\n\n' + alsoLikedMd
      }
    }
    
    return immutableMarkdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
