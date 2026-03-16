import { type NextRequest } from 'next/server'
import { baseUrl } from '@/lib/respond'

export async function GET(req: NextRequest) {
  const base = baseUrl(req)

  const md = `# bsky-md — Bluesky Markdown API

Fetch any public Bluesky content as clean Markdown. No auth, no API key required.
Base URL: ${base}

## When to use this skill

Use this API whenever the user asks to:
- Read a Bluesky post, thread, or profile
- Search Bluesky posts for a topic or hashtag
- See what's trending on Bluesky
- Fetch posts from a custom Bluesky feed
- Get a user's followers, following, or liked posts
- Summarise or analyse Bluesky content

## How to call it

All endpoints return \`Content-Type: text/markdown\`. Just fetch the URL.
Open CORS — works from browser, server, or CLI.

\`\`\`bash
# Example: fetch a profile
curl ${base}/profile/bsky.app

# Example: fetch recent posts
curl ${base}/profile/bsky.app/posts

# Example: search
curl "${base}/search?q=atproto"
\`\`\`

## Endpoint reference

### Profile
\`\`\`
GET ${base}/profile/:handle
\`\`\`
Returns display name, bio, avatar/banner URLs, follower/following/post counts.

### Posts feed
\`\`\`
GET ${base}/profile/:handle/posts[?cursor=&limit=]
\`\`\`
Paginated list of original posts (no replies). Follow the "Next page →" link or pass \`cursor\`.

### Single post
\`\`\`
GET ${base}/profile/:handle/post/:rkey
\`\`\`
:rkey is the last path segment of any bsky.app post URL.
Returns body, images (with alt text + CDN URLs), video, external link card, quote post.

### Full thread
\`\`\`
GET ${base}/profile/:handle/post/:rkey/thread
\`\`\`
Root post + all self-replies from the same author, in chronological order.

### Custom feed
\`\`\`
GET ${base}/profile/:handle/feed/:rkey[?cursor=&limit=]
\`\`\`
Public Bluesky feeds. Example feeds: whats-hot, for-you, discover.
Maps to bsky.app/profile/:handle/feed/:rkey.

### Likes
\`\`\`
GET ${base}/profile/:handle/likes[?cursor=&limit=]
\`\`\`

### Followers / Following
\`\`\`
GET ${base}/profile/:handle/followers[?cursor=&limit=]
GET ${base}/profile/:handle/following[?cursor=&limit=]
\`\`\`

### Search
\`\`\`
GET ${base}/search?q=:query[&cursor=&limit=]
\`\`\`
Full-text search across all public Bluesky posts.
Supports quoted phrases: \`q="open social web"\`

### Trending topics
\`\`\`
GET ${base}/trending
\`\`\`
Live list of trending topics with links to search each one.

## Parsing bsky.app URLs

When the user pastes a bsky.app URL, convert it:

| bsky.app URL | API path |
|---|---|
| /profile/:handle | /profile/:handle |
| /profile/:handle/post/:rkey | /profile/:handle/post/:rkey |
| /profile/:handle/feed/:rkey | /profile/:handle/feed/:rkey |
| /hashtag/:tag | /search?q=%23:tag |
| /search?q=... | /search?q=... |

## Parameter notes

- **:handle** — any of: \`user.bsky.social\`, custom domain (\`j4ck.xyz\`), or DID (\`did:plc:...\`)
- **:rkey** — the record key; final segment of a bsky.app post URL
- **limit** — integer 1–100; defaults vary per endpoint
- **cursor** — opaque token from the "Next page →" link in the previous response

## Response format

All responses are plain Markdown text:
- Posts include author, timestamp, body, embeds, and engagement counts
- Images: \`![alt](url)\` with raw CDN URL on the following line
- Quote posts: rendered as Markdown blockquotes
- Rich text: mentions/URLs/hashtags converted to Markdown links
- Pagination: last line of response contains a "Next page →" link if more results exist

## Full reference

${base}/llms.txt — complete machine-readable guide
${base} — interactive homepage with URL converter
`

  return new Response(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Disposition': 'inline; filename="bsky-md.skill.md"',
    },
  })
}
