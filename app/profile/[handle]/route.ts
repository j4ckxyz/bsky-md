import { type NextRequest } from 'next/server'
import { getProfile } from '@/lib/bsky'
import { renderProfile } from '@/lib/markdown'
import { markdownResponse, errorResponse, optionsResponse, baseUrl, handleRoute } from '@/lib/respond'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  return handleRoute(async () => {
    const { handle } = await params
    const profile = await getProfile(handle)
    const md = renderProfile(profile, baseUrl(req))
    return markdownResponse(md)
  })
}

export async function OPTIONS() {
  return optionsResponse()
}
