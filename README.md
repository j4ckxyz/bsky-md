# 🦋 bsky.md — Bluesky as Markdown

**Live: https://bsky-md.vercel.app**

Fetch any public Bluesky content as clean, portable Markdown. No auth, no API key, just a URL.

## Endpoints

| Route | Description |
|-------|-------------|
| `GET /profile/:handle` | Bio, stats, avatar/banner |
| `GET /profile/:handle/posts` | Paginated posts feed |
| `GET /profile/:handle/post/:rkey` | Single post with embeds |
| `GET /profile/:handle/post/:rkey/thread` | Full self-reply thread |
| `GET /profile/:handle/feed/:rkey` | Public custom feed |
| `GET /profile/:handle/likes` | Posts the user liked |
| `GET /profile/:handle/followers` | Follower list |
| `GET /profile/:handle/following` | Following list |
| `GET /search?q=:query` | Full-text post search |
| `GET /trending` | Trending topics right now |
| `GET /llms.txt` | Machine-readable API guide for agents |

## Features

- Rich text facets → Markdown links (mentions, URLs, hashtags)
- Image embeds with alt text + full CDN URLs
- Video embeds (thumbnail + HLS link)
- External link cards (title, description, thumbnail)
- Quote posts rendered as blockquotes
- Custom feeds (What's Hot, etc.)
- Trending topics
- Pagination cursors on all list endpoints
- `Content-Type: text/markdown`, open CORS, edge-cached

## Usage

```bash
# Profile
curl https://bsky-md.vercel.app/profile/bsky.app

# Posts
curl https://bsky-md.vercel.app/profile/bsky.app/posts

# What's Hot feed
curl https://bsky-md.vercel.app/profile/bsky.app/feed/whats-hot

# Search
curl "https://bsky-md.vercel.app/search?q=atproto"

# Trending
curl https://bsky-md.vercel.app/trending
```

## For LLMs

See [`/llms.txt`](https://bsky-md.vercel.app/llms.txt) for a machine-readable guide to every endpoint.

## Self-hosting with Docker

Run your own instance on any machine — works on Mac, Linux, and Windows. Great paired with a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to make it publicly accessible without opening ports.

```bash
git clone https://tangled.org/j4ck.xyz/bsky-md
cd bsky-md
docker compose up -d
```

Your instance is now running at **http://localhost:3010**.

### Configuration

Edit these values in `docker-compose.yml` before starting:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3010` | Host port to expose |
| `RATE_LIMIT_MAX` | `10` | Max requests per IP per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window size in milliseconds (default: 1 min) |

**Personal use?** Set `RATE_LIMIT_MAX=100` or higher.
**Public instance?** Keep the defaults to protect Bluesky's API.

### Updating

```bash
git pull && docker compose up -d --build
```

### Stopping

```bash
docker compose down
```

## Stack

Next.js 16 · TypeScript · `@atproto/api` · Deployed on Vercel
