import { type NextRequest } from 'next/server'
import { baseUrl } from '@/lib/respond'

export async function GET(req: NextRequest) {
  const base = baseUrl(req)

  const md = `---
name: bsky-md
description: Fetch Bluesky posts, threads, profiles, and search results as clean Markdown via the https://bsky.md service. Use whenever the user shares a https://bsky.app URL or asks to read a Bluesky post, thread, or profile; search Bluesky posts for a topic or hashtag; see what's trending on Bluesky; fetch posts from a custom Bluesky feed; get a user's followers, following, or liked posts; or summarise or analyse Bluesky content.
---

# bsky-md — Bluesky Markdown API

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
GET ${base}/profile/:handle/post/:rkey[?also-liked=true]
\`\`\`
:rkey is the last path segment of any bsky.app post URL.
Returns body, images (with alt text + CDN URLs), video, external link card, quote post.
Pass \`also-liked=true\` to append recommended posts that people who liked this post also liked (via [foryou.club](https://foryou.club/also-liked)).

### Posts also liked by the same people
\`\`\`
GET ${base}/profile/:handle/post/:rkey/also-liked
\`\`\`
Returns a feed of recommended posts liked by people who liked this post (via recommendations from [foryou.club](https://foryou.club/also-liked)).

### Thread
\`\`\`
GET ${base}/profile/:handle/post/:rkey/thread[?full=true]
\`\`\`
Returns thread context.
- **Default**: Root post + replies from the same author, in chronological order.
- **\`?full=true\`**: Bypasses author filtering to return the complete cross-author nested reply tree.

### Who quoted this post
\`\`\`
GET ${base}/profile/:handle/post/:rkey/quotes[?cursor=&limit=]
\`\`\`
Returns a paginated list of all public posts that quote the specified post.

### Actor combined activity
\`\`\`
GET ${base}/profile/:handle/activity[?cursor=&limit=]
\`\`\`
One endpoint returning the actor's combined timeline of posts, replies, and quotes.

### Public Lists
\`\`\`
GET ${base}/profile/:handle/lists[?cursor=&limit=]
GET ${base}/profile/:handle/list/:rkey[?cursor=&limit=]
GET ${base}/list/:atUri[?cursor=&limit=]
\`\`\`
Fetch an actor's public lists, or details and members of a specific list.

### Starter Packs
\`\`\`
GET ${base}/profile/:handle/starter-pack/:rkey
GET ${base}/starter-pack/:atUri
\`\`\`
Fetch starter pack details and listed member profiles.

### First-class AT URI resolver
\`\`\`
GET ${base}/at/:atUri
GET ${base}/at?uri=:atUri
\`\`\`
Resolves any \`at://\` URI (posts, custom feeds, lists, starter packs) and redirects/renders it.

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
GET ${base}/search?q=:query[&since=&until=&from=&lang=&min-likes=&cursor=&limit=]
\`\`\`
Full-text search across all public Bluesky posts.
- **Advanced filters**: Filter by author (\`from=j4ck.xyz\`), date range (\`since=2026-05-01&until=2026-05-23\`), language (\`lang=en\`), and minimum engagement (\`min-likes=10\`).
- Supports quoted phrases: \`q="open social web"\`

### Trending topics
\`\`\`
GET ${base}/trending
\`\`\`
Live list of trending topics with links to search each one.

### Posts linking to a URL or domain
\`\`\`
GET ${base}/links?url=:url
\`\`\`
All public posts that link to a given URL or domain (e.g. \`?url=theverge.com\` or \`?url=https://example.com/article\`).

## Parsing bsky.app URLs

When the user pastes a bsky.app URL, convert it:

| bsky.app URL | API path |
|---|---|
| /profile/:handle | /profile/:handle |
| /profile/:handle/post/:rkey | /profile/:handle/post/:rkey |
| /profile/:handle/feed/:rkey | /profile/:handle/feed/:rkey |
| /profile/:handle/lists | /profile/:handle/lists |
| /profile/:handle/lists/:rkey | /profile/:handle/list/:rkey |
| /starter-pack/:handle/:rkey | /profile/:handle/starter-pack/:rkey |
| /hashtag/:tag | /search?q=%23:tag |
| /search?q=... | /search?q=... |

## Parameter notes

- **:handle** — any of: \`user.bsky.social\`, custom domain (\`j4ck.xyz\`), or DID (\`did:plc:...\`)
- **:rkey** — the record key; final segment of a bsky.app post URL
- **:atUri** — full \`at://\` URI (e.g. \`at://did:plc:xxx/app.bsky.feed.post/rkey\`)
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
