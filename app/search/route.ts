import { type NextRequest, NextResponse } from 'next/server'
import { searchPosts } from '@/lib/bsky'
import { renderSearch } from '@/lib/markdown'
import { markdownResponse, errorResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'
import { isAtUri, redirectPathForAtUri } from '@/lib/at-uri'

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const url = new URL(req.url)
    const query = url.searchParams.get('q')

    if (!query?.trim()) {
      return errorResponse('Missing required query parameter: q', 400)
    }

    // If query is an AT URI, redirect to the parsed route
    if (isAtUri(query)) {
      const redirectPath = redirectPathForAtUri(query)
      if (redirectPath) {
        return NextResponse.redirect(new URL(redirectPath, baseUrl(req)))
      }
    }

    const cursor = url.searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100)
    
    // Parse filters
    const since = url.searchParams.get('since')
    const until = url.searchParams.get('until')
    const fromUser = url.searchParams.get('from')
    const lang = url.searchParams.get('lang')
    const minLikes = parseInt(url.searchParams.get('min-likes') || url.searchParams.get('min_likes') || '0', 10)

    // Build native advanced search query
    let finalQuery = query
    if (fromUser && !finalQuery.includes('from:')) finalQuery += ` from:${fromUser}`
    if (since && !finalQuery.includes('since:')) finalQuery += ` since:${since}`
    if (until && !finalQuery.includes('until:')) finalQuery += ` until:${until}`
    if (lang && !finalQuery.includes('lang:')) finalQuery += ` lang:${lang}`

    const page = await searchPosts(finalQuery, cursor, limit)
    
    // Client-side min-likes filtering
    if (minLikes > 0) {
      page.posts = page.posts.filter((post) => post.likeCount >= minLikes)
    }

    const md = renderSearch(query, page, baseUrl(req))
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
