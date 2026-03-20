import { type NextRequest } from 'next/server'
import { baseUrl } from '@/lib/respond'

export async function GET(req: NextRequest) {
  const base = baseUrl(req)

  const txt = `# Bluesky Markdown API

> Fetch public Bluesky data as clean Markdown. No auth. No API key. Just HTTP GET.

Base URL: ${base}

All responses:
- Content-Type: text/markdown; charset=utf-8
- Access-Control-Allow-Origin: * (open CORS)
- Cached for 60 s, stale-while-revalidate 300 s

---

## Endpoints

### GET /
Returns this API's documentation as Markdown.

### GET /llms.txt
Returns this machine-readable guide (plain text, no markdown rendering needed).

---

### GET /profile/:handle
Returns a user profile.

Parameters:
- handle — Bluesky handle (e.g. bsky.app, j4ck.xyz, user.bsky.social) or DID (did:plc:...)

Response fields:
- Display name, handle, bio/description
- Avatar image URL and banner image URL
- Follower count, following count, post count
- Links to posts, followers, following via this API

Example: ${base}/profile/bsky.app

---

### GET /profile/:handle/posts
Returns a paginated list of a user's posts (no replies).

Query parameters:
- cursor — pagination cursor from previous response (optional)
- limit  — number of posts, 1–100, default 20

Response: list of posts with text, images, link cards, quote posts, engagement stats, and pagination link.

Example: ${base}/profile/bsky.app/posts
Example (paginated): ${base}/profile/bsky.app/posts?cursor=CURSOR&limit=50

---

### GET /profile/:handle/post/:rkey
Returns a single post.

Parameters:
- handle — author's handle (must match the post's author, not a reposter)
- rkey   — record key; the final path segment of a Bluesky post URL

Response: post body with rich text, images (with alt text + full CDN URLs), video thumbnails, external link cards, and quote posts as blockquotes.

Example: ${base}/profile/bsky.app/post/3lhreomsy5k2x

---

### GET /profile/:handle/post/:rkey/thread
Returns the full thread: the given post plus all replies from the same author, in chronological order.

Useful for reading "tweetstorm"-style threads as a single document.

Example: ${base}/profile/bsky.app/post/3lhreomsy5k2x/thread

---

### GET /profile/:handle/likes
Returns a paginated list of posts liked by the user.

Query parameters:
- cursor — pagination cursor (optional)
- limit  — 1–100, default 20

Example: ${base}/profile/bsky.app/likes

---

### GET /profile/:handle/followers
Returns a paginated list of users who follow :handle.

Query parameters:
- cursor — pagination cursor (optional)
- limit  — 1–100, default 50

Response: list of accounts with display name, handle, and first line of bio.

Example: ${base}/profile/bsky.app/followers

---

### GET /profile/:handle/following
Returns a paginated list of users that :handle follows.

Query parameters:
- cursor — pagination cursor (optional)
- limit  — 1–100, default 50

Example: ${base}/profile/bsky.app/following

---

### GET /search?q=:query
Full-text search across all public Bluesky posts.

Query parameters:
- q      — search query (required); supports quoted phrases and boolean operators
- cursor — pagination cursor (optional)
- limit  — 1–100, default 20

Response: matching posts with author, text, embeds, engagement stats, and pagination.

Example: ${base}/search?q=atproto
Example: ${base}/search?q="open social web"&limit=10

---

### GET /links?url=:url
Find all public Bluesky posts that link to a given URL or domain.

Query parameters:
- url    — full URL (e.g. https://example.com/article) or bare domain (e.g. example.com) (required)
- cursor — pagination cursor (optional)
- limit  — 1–100, default 50

Response: matching posts with author, text, embeds, engagement stats, and pagination.

Example: ${base}/links?url=theverge.com
Example: ${base}/links?url=https://example.com/some-article

---

## Embed types returned in posts

- Images       — inline Markdown image syntax with alt text + raw CDN URL
- External link — bold linked title, blockquote description, thumbnail image
- Quote post   — rendered as a Markdown blockquote with author, date, and body
- Video        — thumbnail image + "Watch (HLS)" link to playlist URL

---

## Rich text

Mentions (@handle), URLs, and hashtags (#tag) in post bodies are converted to
Markdown links pointing to bsky.app.

---

## Pagination

When more results exist, the response contains a "Next page →" link at the
bottom with the cursor pre-encoded. You can also extract the cursor from that
URL's ?cursor= parameter and pass it to subsequent requests.

---

## Error handling

- 404 — handle or post not found
- 400 — missing required parameter (e.g. no ?q= on /search)
- 500 — upstream Bluesky API error (message included in plain text body)

Error responses use Content-Type: text/plain.

---

## Notes for LLM agents

- Fetch ${base}/profile/:handle to get a user overview and a link to their posts.
- Fetch ${base}/profile/:handle/posts to read recent posts; follow "Next page →" for more.
- Fetch ${base}/profile/:handle/post/:rkey/thread to get a complete multi-post thread.
- Fetch ${base}/search?q=TOPIC to discover posts about a topic without knowing any handles.
- Fetch ${base}/links?url=DOMAIN to find all posts linking to a website or specific URL.
- All responses are plain Markdown — strip formatting or feed directly into context windows.
- No rate limiting is imposed by this API, but Bluesky's public API may throttle heavy use.
`

  return new Response(txt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
