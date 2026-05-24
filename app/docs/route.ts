import { type NextRequest } from 'next/server'
import { markdownResponse, baseUrl } from '@/lib/respond'

export async function GET(req: NextRequest) {
  const base = baseUrl(req)

  const md = `# Bluesky Markdown API

Returns public Bluesky data as plain Markdown. No authentication or API key required.
All responses use \`Content-Type: text/markdown; charset=utf-8\` and open CORS headers.

**Machine-readable guide for agents:** [${base}/llms.txt](${base}/llms.txt)

---

## Endpoints

### Profile

\`\`\`
GET ${base}/profile/:handle
\`\`\`

Returns a user's display name, bio, avatar/banner image URLs, follower counts, and links to their content.

**Example:** [${base}/profile/bsky.app](${base}/profile/bsky.app)

---

### Posts

\`\`\`
GET ${base}/profile/:handle/posts
GET ${base}/profile/:handle/posts?cursor=<cursor>&limit=<1-100>
\`\`\`

Paginated list of original posts (replies excluded). Each post includes body text, images, link cards, quote posts, and engagement stats.

**Example:** [${base}/profile/bsky.app/posts](${base}/profile/bsky.app/posts)

---

### Single Post

\`\`\`
GET ${base}/profile/:handle/post/:rkey
\`\`\`

A single post with full embed rendering: images (alt text + CDN URL), video thumbnails, external link cards, and quoted posts as blockquotes.

**Example:** [${base}/profile/bsky.app/post/3lhreomsy5k2x](${base}/profile/bsky.app/post/3lhreomsy5k2x)

---

### Thread

\`\`\`
GET ${base}/profile/:handle/post/:rkey/thread
\`\`\`

The full thread starting from the given post: root post followed by all self-replies from the same author, in chronological order. Ideal for reading "tweetstorm"-style threads.

**Example:** [${base}/profile/bsky.app/post/3lhreomsy5k2x/thread](${base}/profile/bsky.app/post/3lhreomsy5k2x/thread)

---


### Followers

\`\`\`
GET ${base}/profile/:handle/followers
GET ${base}/profile/:handle/followers?cursor=<cursor>&limit=<1-100>
\`\`\`

Paginated list of accounts that follow this user, with display name, handle, and bio excerpt.

**Example:** [${base}/profile/bsky.app/followers](${base}/profile/bsky.app/followers)

---

### Following

\`\`\`
GET ${base}/profile/:handle/following
GET ${base}/profile/:handle/following?cursor=<cursor>&limit=<1-100>
\`\`\`

Paginated list of accounts this user follows.

**Example:** [${base}/profile/bsky.app/following](${base}/profile/bsky.app/following)

---

### Search

\`\`\`
GET ${base}/search?q=<query>
GET ${base}/search?q=<query>&cursor=<cursor>&limit=<1-100>
\`\`\`

Full-text search across all public Bluesky posts. Supports quoted phrases and boolean operators.

**Example:** [${base}/search?q=atproto](${base}/search?q=atproto)
**Example:** [${base}/search?q="open social web"](${base}/search?q=%22open+social+web%22)

---

### Links

\`\`\`
GET ${base}/links?url=<url-or-domain>
GET ${base}/links?url=<url-or-domain>&cursor=<cursor>&limit=<1-100>
\`\`\`

Find all public Bluesky posts that link to a given URL or domain.

**Example:** [${base}/links?url=theverge.com](${base}/links?url=theverge.com)
**Example:** [${base}/links?url=https://example.com/article](${base}/links?url=https%3A%2F%2Fexample.com%2Farticle)

---

## Embed types

| Type | Rendered as |
|------|-------------|
| Images | \`![alt](url)\` with alt text line + raw CDN URL |
| External link | Bold linked title, blockquote description, thumbnail |
| Quote post | Markdown blockquote with author, date, body |
| Video | Thumbnail image + HLS playlist link |

---

## Rich text

Mentions, URLs, and hashtags in post bodies are converted to Markdown links pointing to \`bsky.app\`.

---

## Parameters

- **:handle** — any Bluesky handle (\`user.bsky.social\`, custom domain like \`j4ck.xyz\`) or DID (\`did:plc:...\`)
- **:rkey** — the record key: last segment of a Bluesky post URL
- **cursor** — opaque pagination token returned in previous response
- **limit** — integer 1–100 (defaults vary per endpoint)

---

## Caching & CORS

- Responses are edge-cached for **60 seconds**, stale-while-revalidate for **5 minutes**
- \`Access-Control-Allow-Origin: *\` — usable from any browser or tool
- \`OPTIONS\` preflight → \`204 No Content\`

---

## Error responses

| Status | Meaning |
|--------|---------|
| 400 | Bad request (e.g. missing \`?q=\` on /search) |
| 404 | Handle or post not found |
| 500 | Upstream Bluesky API error |

Errors return \`Content-Type: text/plain\` with a message body.

---

## Use cases

- LLM context windows — clean plain text, no HTML noise
- Obsidian plugins / Dataview queries
- RSS readers and note-taking apps
- Any tool that can fetch a URL and render Markdown

---

*Source: [github.com/j4ckxyz/bsky-md](https://github.com/j4ckxyz/bsky-md)*
`

  return markdownResponse(md)
}
