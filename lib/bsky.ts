import { AtpAgent, AppBskyFeedDefs } from '@atproto/api'
import type {
  AppBskyActorDefs,
  AppBskyRichtextFacet,
  AppBskyEmbedImages,
  AppBskyEmbedExternal,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
} from '@atproto/api'

// ─── Client ──────────────────────────────────────────────────────────────────

const agent = new AtpAgent({ service: 'https://public.api.bsky.app' })

// Search requires the full api.bsky.app (public.api.bsky.app blocks it)
const searchAgent = new AtpAgent({ service: 'https://api.bsky.app' })

/** Simple in-memory cache for handle → DID resolution within a process lifetime. */
const didCache = new Map<string, string>()

async function resolveDid(handle: string): Promise<string> {
  // Already a DID — no lookup needed
  if (handle.startsWith('did:')) return handle

  const cached = didCache.get(handle)
  if (cached) return cached

  const res = await agent.resolveHandle({ handle })
  didCache.set(handle, res.data.did)
  return res.data.did
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Profile = AppBskyActorDefs.ProfileViewDetailed

export interface PostData {
  uri: string
  cid: string
  author: AppBskyActorDefs.ProfileViewBasic
  text: string
  facets?: AppBskyRichtextFacet.Main[]
  embed?: EmbedView
  replyCount: number
  repostCount: number
  likeCount: number
  indexedAt: string
  /** rkey extracted from the AT URI */
  rkey: string
  /** true if this post is a reply to another post */
  isReply: boolean
  /** AT URI of the root post (if this is a reply) */
  rootUri?: string
}

export type EmbedView =
  | ({ $type: 'app.bsky.embed.images#view' } & AppBskyEmbedImages.View)
  | ({ $type: 'app.bsky.embed.external#view' } & AppBskyEmbedExternal.View)
  | ({ $type: 'app.bsky.embed.record#view' } & AppBskyEmbedRecord.View)
  | ({ $type: 'app.bsky.embed.recordWithMedia#view' } & AppBskyEmbedRecordWithMedia.View)
  | ({ $type: 'app.bsky.embed.video#view' } & AppBskyEmbedVideo.View)

export interface ActorPage {
  actors: AppBskyActorDefs.ProfileView[]
  cursor?: string
}

export interface SearchPage {
  posts: PostData[]
  cursor?: string
  hitsTotal?: number
}

export interface ThreadData {
  root: PostData
  replies: PostData[]
}

export interface FeedPage {
  posts: PostData[]
  cursor?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rkeyFromUri(uri: string): string {
  return uri.split('/').at(-1) ?? uri
}

function postViewToPostData(post: AppBskyFeedDefs.PostView): PostData {
  const record = post.record as {
    text: string
    facets?: AppBskyRichtextFacet.Main[]
    reply?: { root: { uri: string }; parent: { uri: string } }
  }

  return {
    uri: post.uri,
    cid: post.cid,
    author: post.author,
    text: record.text ?? '',
    facets: record.facets,
    embed: post.embed as EmbedView | undefined,
    replyCount: post.replyCount ?? 0,
    repostCount: post.repostCount ?? 0,
    likeCount: post.likeCount ?? 0,
    indexedAt: post.indexedAt,
    rkey: rkeyFromUri(post.uri),
    isReply: !!record.reply,
    rootUri: record.reply?.root.uri,
  }
}

/**
 * Recursively walk a ThreadViewPost tree and collect all posts authored by
 * `authorDid`, in the order they appear depth-first (chronological for linear
 * threads).
 *
 * We cast through `unknown` when using the type guard because @atproto/api
 * v0.13+ wraps reply union members with `$Typed<T>` (adds `$type: string`
 * as required) while the base `ThreadViewPost` interface has `$type?` optional,
 * causing TS2677 when using the type predicate directly.
 */
function collectAuthorPosts(
  node: AppBskyFeedDefs.ThreadViewPost,
  authorDid: string,
  acc: PostData[] = [],
): PostData[] {
  if (node.post.author.did === authorDid) {
    acc.push(postViewToPostData(node.post))
  }

  if (node.replies) {
    // Filter and cast via unknown to avoid TS2677 with $Typed<T> mismatch
    const authorReplies = (node.replies as unknown[])
      .filter(
        (r) =>
          AppBskyFeedDefs.isThreadViewPost(r) &&
          (r as AppBskyFeedDefs.ThreadViewPost).post.author.did === authorDid,
      )
      .map((r) => r as AppBskyFeedDefs.ThreadViewPost)

    authorReplies.sort(
      (a, b) => new Date(a.post.indexedAt).getTime() - new Date(b.post.indexedAt).getTime(),
    )
    for (const reply of authorReplies) {
      collectAuthorPosts(reply, authorDid, acc)
    }
  }

  return acc
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getProfile(handle: string): Promise<Profile> {
  const res = await agent.getProfile({ actor: handle })
  return res.data
}

export async function getFeed(
  handle: string,
  cursor?: string,
  limit = 20,
): Promise<FeedPage> {
  const res = await agent.getAuthorFeed({
    actor: handle,
    cursor,
    limit: Math.min(limit, 100),
    filter: 'posts_no_replies',
  })

  return {
    posts: res.data.feed.map(({ post }) => postViewToPostData(post)),
    cursor: res.data.cursor,
  }
}

export async function getPost(handle: string, rkey: string): Promise<PostData> {
  const did = await resolveDid(handle)
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`
  const res = await agent.getPosts({ uris: [uri] })
  const post = res.data.posts[0]
  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 })
  return postViewToPostData(post)
}

export async function getLikes(
  handle: string,
  cursor?: string,
  limit = 20,
): Promise<FeedPage> {
  const res = await agent.getActorLikes({
    actor: handle,
    cursor,
    limit: Math.min(limit, 100),
  })

  return {
    posts: res.data.feed.map(({ post }) => postViewToPostData(post)),
    cursor: res.data.cursor,
  }
}

export async function getFollowers(
  handle: string,
  cursor?: string,
  limit = 50,
): Promise<ActorPage> {
  const res = await agent.getFollowers({
    actor: handle,
    cursor,
    limit: Math.min(limit, 100),
  })

  return {
    actors: res.data.followers,
    cursor: res.data.cursor,
  }
}

export async function getFollowing(
  handle: string,
  cursor?: string,
  limit = 50,
): Promise<ActorPage> {
  const res = await agent.getFollows({
    actor: handle,
    cursor,
    limit: Math.min(limit, 100),
  })

  return {
    actors: res.data.follows,
    cursor: res.data.cursor,
  }
}

export async function searchPosts(
  query: string,
  cursor?: string,
  limit = 20,
): Promise<SearchPage> {
  const res = await searchAgent.app.bsky.feed.searchPosts({
    q: query,
    cursor,
    limit: Math.min(limit, 100),
  })

  return {
    posts: res.data.posts.map((post) => postViewToPostData(post)),
    cursor: res.data.cursor,
    hitsTotal: res.data.hitsTotal,
  }
}

export interface TrendingTopic {
  topic: string
  displayName?: string
  link?: string
  startedAt?: string
  status?: string
  postCount?: number
}

export interface TrendingData {
  topics: TrendingTopic[]
}

export async function getCustomFeed(
  handle: string,
  rkey: string,
  cursor?: string,
  limit = 20,
): Promise<FeedPage> {
  const did = await resolveDid(handle)
  const feedUri = `at://${did}/app.bsky.feed.generator/${rkey}`
  const res = await agent.app.bsky.feed.getFeed({
    feed: feedUri,
    cursor,
    limit: Math.min(limit, 100),
  })
  return {
    posts: res.data.feed.map(({ post }) => postViewToPostData(post)),
    cursor: res.data.cursor,
  }
}

export async function getTrending(): Promise<TrendingData> {
  const res = await fetch(
    'https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics',
    { next: { revalidate: 60 } } as RequestInit,
  )
  if (!res.ok) throw Object.assign(new Error('Failed to fetch trending topics'), { status: res.status })
  const data = (await res.json()) as { topics?: TrendingTopic[] }
  return { topics: data.topics ?? [] }
}

export async function getThread(handle: string, rkey: string): Promise<ThreadData> {
  const did = await resolveDid(handle)
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`
  const res = await agent.getPostThread({ uri, depth: 1000, parentHeight: 0 })

  if (!AppBskyFeedDefs.isThreadViewPost(res.data.thread as unknown)) {
    throw Object.assign(new Error('Thread not found'), { status: 404 })
  }

  const root = res.data.thread as AppBskyFeedDefs.ThreadViewPost
  const authorDid = root.post.author.did

  // Collect all posts: start with root, then replies recursively
  const all = collectAuthorPosts(root, authorDid)
  const [rootPost, ...replies] = all

  return { root: rootPost, replies }
}
