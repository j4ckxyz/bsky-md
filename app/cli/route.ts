import { NextRequest } from 'next/server'

export const runtime = 'edge'
export const revalidate = 3600

export function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? 'bsky-md.vercel.app'
  const scheme = host.startsWith('localhost') ? 'http' : 'https'
  const base = `${scheme}://${host}`

  const body = `# bsky.md — Bluesky as Markdown

Fetch any public Bluesky profile, post, feed, or search as clean Markdown.
No auth. No API key. Just HTTP.

  ${base}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Quick start

  curl ${base}/profile/j4ck.xyz
  curl ${base}/profile/jcsalterego.bsky.social
  curl ${base}/profile/jcsalterego.bsky.social/feed
  curl ${base}/profile/j4ck.xyz/followers
  curl "${base}/search?q=atproto"
  curl ${base}/trending

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Endpoints

  /profile/:handle                 Bio, stats, pinned post
  /profile/:handle/feed            Recent posts (paginated)
  /profile/:handle/post/:rkey      Single post with embeds
  /profile/:handle/post/:rkey/thread  Full thread
  /profile/:handle/feed/:rkey      Public custom feed
  /profile/:handle/likes           Posts the user liked
  /profile/:handle/followers       Follower list
  /profile/:handle/following       Following list
  /search?q=:query                 Full-text post search
  /trending                        Trending topics right now
  /llms.txt                        Machine-readable API guide (for agents)
  /skill.md                        Agent skill file (Claude, Cursor, Windsurf…)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## More examples

  # A specific post
  curl ${base}/profile/j4ck.xyz/post/$(echo "find a rkey at bsky.app/profile/j4ck.xyz")

  # Thread
  curl ${base}/profile/jcsalterego.bsky.social/post/<rkey>/thread

  # Custom feed
  curl ${base}/profile/bsky.app/feed/whats-hot

  # Pagination
  curl "${base}/profile/jcsalterego.bsky.social/feed?limit=5"

  # Search
  curl "${base}/search?q=%23rust+lang"
  curl "${base}/search?q=open+source"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Add to your coding agent

  # Claude Code (global /bsky slash command)
  curl -s ${base}/skill.md > ~/.claude/commands/bsky.md

  # Any project (CLAUDE.md / .cursorrules / .windsurfrules)
  curl -s ${base}/skill.md >> CLAUDE.md

  # GitHub Copilot
  mkdir -p .github && curl -s ${base}/skill.md >> .github/copilot-instructions.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source: https://tangled.org/j4ck.xyz/bsky-md
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Robots-Tag': 'noindex',
    },
  })
}
