import { type NextRequest } from 'next/server'
import { getThread } from '@/lib/bsky'
import { renderThread } from '@/lib/markdown'
import { immutableMarkdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string; rkey: string }> },
) {
  return handleRoute(async () => {
    const { handle, rkey } = await params
    const thread = await getThread(handle, rkey)
    const md = renderThread(thread, baseUrl(req))
    return immutableMarkdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
