import { type NextRequest } from 'next/server'
import { getStarterPack } from '@/lib/bsky'
import { renderStarterPack } from '@/lib/markdown'
import { markdownResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string; rkey: string }> },
) {
  return handleRoute(async () => {
    const { handle, rkey } = await params
    const page = await getStarterPack(handle, rkey)
    const md = renderStarterPack(handle, rkey, page, baseUrl(req))
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
