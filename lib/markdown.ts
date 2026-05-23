import type {
  AppBskyRichtextFacet,
  AppBskyEmbedImages,
  AppBskyEmbedExternal,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
  AppBskyActorDefs,
} from '@atproto/api'
import type { Profile, PostData, ThreadData, FeedPage, EmbedView, ActorPage, SearchPage, TrendingData, NestedReply } from './bsky'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function bskyPostUrl(handle: string, rkey: string): string {
  return `https://bsky.app/profile/${handle}/post/${rkey}`
}

function bskyProfileUrl(handle: string): string {
  return `https://bsky.app/profile/${handle}`
}

function apiPostUrl(handle: string, rkey: string): string {
  return `/profile/${handle}/post/${rkey}`
}

function apiThreadUrl(handle: string, rkey: string): string {
  return `/profile/${handle}/post/${rkey}/thread`
}

function apiProfileUrl(handle: string): string {
  return `/profile/${handle}`
}

function apiPostsUrl(handle: string): string {
  return `/profile/${handle}/posts`
}

function hr(): string {
  return '\n\n---\n\n'
}

// ─── Rich Text / Facets ───────────────────────────────────────────────────────

/**
 * Convert Bluesky rich text (text + facets) to Markdown.
 * Facets use UTF-8 byte offsets, so we work at the byte level.
 */
export function richTextToMarkdown(
  text: string,
  facets?: AppBskyRichtextFacet.Main[],
): string {
  if (!facets || facets.length === 0) return escapeMarkdown(text)

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const bytes = encoder.encode(text)

  // Sort facets by byteStart; discard overlapping ones
  const sorted = [...facets]
    .filter(
      (f) =>
        f.index.byteStart >= 0 &&
        f.index.byteEnd <= bytes.length &&
        f.index.byteStart < f.index.byteEnd,
    )
    .sort((a, b) => a.index.byteStart - b.index.byteStart)

  let result = ''
  let cursor = 0

  for (const facet of sorted) {
    const { byteStart, byteEnd } = facet.index
    if (byteStart < cursor) continue // skip overlapping

    // Plain text before this facet
    result += escapeMarkdown(decoder.decode(bytes.slice(cursor, byteStart)))

    const facetText = decoder.decode(bytes.slice(byteStart, byteEnd))
    const feature = facet.features[0]

    if (!feature) {
      result += escapeMarkdown(facetText)
    } else if (feature.$type === 'app.bsky.richtext.facet#link') {
      const f = feature as AppBskyRichtextFacet.Link
      result += `[${escapeMarkdown(facetText)}](${f.uri})`
    } else if (feature.$type === 'app.bsky.richtext.facet#mention') {
      const f = feature as AppBskyRichtextFacet.Mention
      result += `[${escapeMarkdown(facetText)}](${bskyProfileUrl(f.did)})`
    } else if (feature.$type === 'app.bsky.richtext.facet#tag') {
      const f = feature as AppBskyRichtextFacet.Tag
      result += `[${escapeMarkdown(facetText)}](https://bsky.app/hashtag/${f.tag})`
    } else {
      result += escapeMarkdown(facetText)
    }

    cursor = byteEnd
  }

  // Remaining plain text
  result += escapeMarkdown(decoder.decode(bytes.slice(cursor)))
  return result
}

/**
 * Escape characters that have special meaning in Markdown, but only outside
 * of URLs/links (caller is responsible for not passing already-formatted spans).
 * We're conservative: only escape characters that commonly cause rendering
 * issues in ambient text.
 */
function escapeMarkdown(text: string): string {
  // Don't escape inside words — only escape structural markdown chars
  // This prevents turning normal text into accidental headers / bold / etc.
  return text
    .replace(/\\/g, '\\\\')
    .replace(/^(#{1,6}) /gm, (_, h) => `\\${h} `) // headings at line start
    .replace(/\*\*/g, '\\*\\*')
    .replace(/(?<!\*)\*(?!\*)/g, '\\*') // single asterisks (italic)
    .replace(/^> /gm, '\\> ') // blockquotes at line start
    .replace(/^---$/gm, '\\---') // HR-like lines
}

// ─── Embed Rendering ──────────────────────────────────────────────────────────

function renderEmbed(embed: EmbedView, authorDid: string): string {
  const type = embed.$type as string

  if (type === 'app.bsky.embed.images#view') {
    const e = embed as unknown as AppBskyEmbedImages.View
    return e.images
      .map((img) => {
        const alt = img.alt || 'image'
        const lines = [`![${alt}](${img.fullsize})`]
        if (img.alt) lines.push(`*Alt: ${img.alt}*`)
        return lines.join('\n')
      })
      .join('\n\n')
  }

  if (type === 'app.bsky.embed.external#view') {
    const e = embed as unknown as AppBskyEmbedExternal.View
    const { uri, title, description, thumb } = e.external
    const lines: string[] = [`**[${title || uri}](${uri})**`]
    if (description) lines.push(`> ${description}`)
    if (thumb) lines.push(`![Preview](${thumb})`)
    return lines.join('\n')
  }

  if (type === 'app.bsky.embed.record#view') {
    const e = embed as unknown as AppBskyEmbedRecord.View
    const rec = e.record
    if (rec.$type === 'app.bsky.embed.record#viewRecord') {
      const vr = rec as AppBskyEmbedRecord.ViewRecord
      const handle = vr.author.handle
      const rkey = vr.uri.split('/').at(-1) ?? ''
      const text = (vr.value as { text?: string }).text ?? ''
      const facets = (vr.value as { facets?: AppBskyRichtextFacet.Main[] }).facets
      const formattedText = richTextToMarkdown(text, facets)

      const quoteLines: string[] = []
      if (formattedText.trim()) {
        quoteLines.push(formattedText)
      }

      // Render any media/embeds within the quoted post
      const embeds = (vr as any).embeds as EmbedView[] | undefined
      if (embeds && embeds.length > 0) {
        const embedMds = embeds
          .map((emb) => renderEmbed(emb, vr.author.did))
          .filter(Boolean)
        if (embedMds.length > 0) {
          quoteLines.push(embedMds.join('\n\n'))
        }
      }

      const replyCount = (vr as any).replyCount ?? 0
      const repostCount = (vr as any).repostCount ?? 0
      const likeCount = (vr as any).likeCount ?? 0
      quoteLines.push(`💬 ${formatNumber(replyCount)} · 🔁 ${formatNumber(repostCount)} · ❤️ ${formatNumber(likeCount)}`)

      const header = `**[@${handle}](${bskyProfileUrl(handle)})** · [${formatDate(vr.indexedAt)}](${bskyPostUrl(handle, rkey)})`
      const body = quoteLines.join('\n\n')
      const fullQuote = `${header}\n\n${body}`

      return fullQuote
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')
    }
    return ''
  }

  if (type === 'app.bsky.embed.video#view') {
    const e = embed as unknown as AppBskyEmbedVideo.View
    const lines: string[] = []
    if (e.thumbnail) lines.push(`![${e.alt || 'video thumbnail'}](${e.thumbnail})`)
    lines.push(`**Video**${e.alt ? `: ${e.alt}` : ''}`)
    if (e.playlist) lines.push(`[Watch (HLS)](${e.playlist})`)
    return lines.join('\n')
  }

  if (type === 'app.bsky.embed.recordWithMedia#view') {
    const e = embed as unknown as AppBskyEmbedRecordWithMedia.View
    const mediaPart = renderEmbed(e.media as EmbedView, authorDid)
    const recordPart = renderEmbed(
      { ...e.record, $type: 'app.bsky.embed.record#view' } as EmbedView,
      authorDid,
    )
    return [mediaPart, recordPart].filter(Boolean).join('\n\n')
  }

  return ''
}

// ─── Post Block ───────────────────────────────────────────────────────────────

/**
 * Render a single PostData into a markdown block (no surrounding HR).
 */
export function renderPostBlock(post: PostData): string {
  const handle = post.author.handle
  const date = formatDate(post.indexedAt)
  const bskyUrl = bskyPostUrl(handle, post.rkey)

  const lines: string[] = []

  // Author + timestamp header
  lines.push(`**[@${handle}](${bskyProfileUrl(handle)})** · [${date}](${bskyUrl})`)
  lines.push('')

  // Body text with rich text facets rendered as markdown
  const body = richTextToMarkdown(post.text, post.facets)
  if (body.trim()) {
    lines.push(body)
  }

  // Embed
  if (post.embed) {
    const embedMd = renderEmbed(post.embed, post.author.did)
    if (embedMd.trim()) {
      lines.push('')
      lines.push(embedMd)
    }
  }

  // Engagement stats
  lines.push('')
  lines.push(
    `💬 ${formatNumber(post.replyCount)} · 🔁 ${formatNumber(post.repostCount)} · ❤️ ${formatNumber(post.likeCount)}`,
  )

  return lines.join('\n')
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function renderProfile(profile: Profile, baseUrl: string): string {
  const handle = profile.handle
  const displayName = profile.displayName || handle
  const lines: string[] = []

  lines.push(`# ${displayName} ([@${handle}](${bskyProfileUrl(handle)}))`)
  lines.push('')

  if (profile.description) {
    lines.push(profile.description)
    lines.push('')
  }

  // Avatar / Banner
  if (profile.avatar) {
    lines.push(`**Avatar:** ![avatar](${profile.avatar})`)
    lines.push(`**Avatar URL:** ${profile.avatar}`)
  }
  if (profile.banner) {
    lines.push(`**Banner:** ![banner](${profile.banner})`)
    lines.push(`**Banner URL:** ${profile.banner}`)
  }
  lines.push('')

  // Stats
  lines.push(
    [
      `**Followers:** ${formatNumber(profile.followersCount ?? 0)}`,
      `**Following:** ${formatNumber(profile.followsCount ?? 0)}`,
      `**Posts:** ${formatNumber(profile.postsCount ?? 0)}`,
    ].join(' · '),
  )

  lines.push(hr())

  // Links to API endpoints
  lines.push(`## Posts`)
  lines.push('')
  lines.push(
    `[View posts via this API](${baseUrl}${apiPostsUrl(handle)}) · [View on Bluesky](${bskyProfileUrl(handle)})`,
  )

  lines.push(hr())

  lines.push(
    `*Profile retrieved via [bsky-markdown-api](${baseUrl}) · [DID: ${profile.did}](${bskyProfileUrl(handle)})*`,
  )

  return lines.join('\n')
}

// ─── Feed / Posts List ────────────────────────────────────────────────────────

export function renderFeed(
  handle: string,
  page: FeedPage,
  baseUrl: string,
  cursor?: string,
): string {
  const lines: string[] = []

  lines.push(`# Posts by [@${handle}](${bskyProfileUrl(handle)})`)
  lines.push('')
  lines.push(
    `[Profile](${baseUrl}${apiProfileUrl(handle)}) · [View on Bluesky](${bskyProfileUrl(handle)})`,
  )

  if (page.posts.length === 0) {
    lines.push(hr())
    lines.push('*No posts found.*')
    return lines.join('\n')
  }

  for (const post of page.posts) {
    lines.push(hr())
    lines.push(renderPostBlock(post))
    lines.push('')
    lines.push(
      `[View post](${baseUrl}${apiPostUrl(handle, post.rkey)}) · [View thread](${baseUrl}${apiThreadUrl(handle, post.rkey)}) · [View on Bluesky](${bskyPostUrl(handle, post.rkey)})`,
    )
  }

  lines.push(hr())

  // Pagination
  if (page.cursor) {
    lines.push(
      `[Next page →](${baseUrl}${apiPostsUrl(handle)}?cursor=${encodeURIComponent(page.cursor)})`,
    )
  } else {
    lines.push('*End of posts.*')
  }

  return lines.join('\n')
}

// ─── Single Post ──────────────────────────────────────────────────────────────

export function renderPost(post: PostData, baseUrl: string): string {
  const handle = post.author.handle
  const lines: string[] = []

  lines.push(`# Post by [@${handle}](${bskyProfileUrl(handle)})`)
  lines.push('')

  if (post.isReply) {
    lines.push(`*This post is a reply.*`)
    lines.push('')
  }

  lines.push(renderPostBlock(post))

  lines.push(hr())

  lines.push(
    `[View thread](${baseUrl}${apiThreadUrl(handle, post.rkey)}) · [View profile](${baseUrl}${apiProfileUrl(handle)}) · [View on Bluesky](${bskyPostUrl(handle, post.rkey)})`,
  )

  return lines.join('\n')
}

// ─── Likes ────────────────────────────────────────────────────────────────────

export function renderLikes(handle: string, page: FeedPage, baseUrl: string): string {
  const lines: string[] = []

  lines.push(`# Posts liked by [@${handle}](${bskyProfileUrl(handle)})`)
  lines.push('')
  lines.push(
    `[Profile](${baseUrl}${apiProfileUrl(handle)}) · [View on Bluesky](${bskyProfileUrl(handle)})`,
  )

  if (page.posts.length === 0) {
    lines.push(hr())
    lines.push('*No liked posts found.*')
    return lines.join('\n')
  }

  for (const post of page.posts) {
    lines.push(hr())
    lines.push(renderPostBlock(post))
    lines.push('')
    lines.push(
      `[View post](${baseUrl}${apiPostUrl(post.author.handle, post.rkey)}) · [View on Bluesky](${bskyPostUrl(post.author.handle, post.rkey)})`,
    )
  }

  lines.push(hr())
  if (page.cursor) {
    lines.push(
      `[Next page →](${baseUrl}/profile/${handle}/likes?cursor=${encodeURIComponent(page.cursor)})`,
    )
  } else {
    lines.push('*End of liked posts.*')
  }

  return lines.join('\n')
}

// ─── Followers / Following ────────────────────────────────────────────────────

function renderActorList(
  title: string,
  handle: string,
  page: ActorPage,
  baseUrl: string,
  nextUrl: (cursor: string) => string,
): string {
  const lines: string[] = []

  lines.push(`# ${title}`)
  lines.push('')
  lines.push(
    `[Profile](${baseUrl}${apiProfileUrl(handle)}) · [View on Bluesky](${bskyProfileUrl(handle)})`,
  )

  if (page.actors.length === 0) {
    lines.push(hr())
    lines.push('*None found.*')
    return lines.join('\n')
  }

  lines.push(hr())

  for (const actor of page.actors) {
    const displayName = actor.displayName || actor.handle
    lines.push(
      `**[${displayName}](${baseUrl}${apiProfileUrl(actor.handle)})** · [@${actor.handle}](${bskyProfileUrl(actor.handle)})`,
    )
    if (actor.description) {
      lines.push(`> ${actor.description.split('\n')[0]}`)
    }
    lines.push('')
  }

  lines.push(hr())

  if (page.cursor) {
    lines.push(`[Next page →](${nextUrl(page.cursor)})`)
  } else {
    lines.push('*End of list.*')
  }

  return lines.join('\n')
}

export function renderFollowers(handle: string, page: ActorPage, baseUrl: string): string {
  return renderActorList(
    `Followers of [@${handle}](${bskyProfileUrl(handle)})`,
    handle,
    page,
    baseUrl,
    (cursor) =>
      `${baseUrl}/profile/${handle}/followers?cursor=${encodeURIComponent(cursor)}`,
  )
}

export function renderFollowing(handle: string, page: ActorPage, baseUrl: string): string {
  return renderActorList(
    `[@${handle}](${bskyProfileUrl(handle)}) is following`,
    handle,
    page,
    baseUrl,
    (cursor) =>
      `${baseUrl}/profile/${handle}/following?cursor=${encodeURIComponent(cursor)}`,
  )
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function renderSearch(query: string, page: SearchPage, baseUrl: string): string {
  const lines: string[] = []

  lines.push(`# Search results for "${escapeMarkdown(query)}"`)
  lines.push('')
  if (page.hitsTotal !== undefined) {
    lines.push(`*${formatNumber(page.hitsTotal)} total results*`)
    lines.push('')
  }

  if (page.posts.length === 0) {
    lines.push('*No posts found.*')
    return lines.join('\n')
  }

  for (const post of page.posts) {
    lines.push(hr())
    lines.push(renderPostBlock(post))
    lines.push('')
    lines.push(
      `[View post](${baseUrl}${apiPostUrl(post.author.handle, post.rkey)}) · [View thread](${baseUrl}${apiThreadUrl(post.author.handle, post.rkey)}) · [View on Bluesky](${bskyPostUrl(post.author.handle, post.rkey)})`,
    )
  }

  lines.push(hr())

  if (page.cursor) {
    lines.push(
      `[Next page →](${baseUrl}/search?q=${encodeURIComponent(query)}&cursor=${encodeURIComponent(page.cursor)})`,
    )
  } else {
    lines.push('*End of results.*')
  }

  return lines.join('\n')
}

// ─── Links / URL search ───────────────────────────────────────────────────────

export function renderLinks(url: string, page: SearchPage, baseUrl: string): string {
  const lines: string[] = []

  lines.push(`# Posts linking to ${escapeMarkdown(url)}`)
  lines.push('')
  if (page.hitsTotal !== undefined) {
    lines.push(`*${formatNumber(page.hitsTotal)} total results*`)
    lines.push('')
  }

  if (page.posts.length === 0) {
    lines.push('*No posts found.*')
    return lines.join('\n')
  }

  for (const post of page.posts) {
    lines.push(hr())
    lines.push(renderPostBlock(post))
    lines.push('')
    lines.push(
      `[View post](${baseUrl}${apiPostUrl(post.author.handle, post.rkey)}) · [View thread](${baseUrl}${apiThreadUrl(post.author.handle, post.rkey)}) · [View on Bluesky](${bskyPostUrl(post.author.handle, post.rkey)})`,
    )
  }

  lines.push(hr())

  if (page.cursor) {
    lines.push(
      `[Next page →](${baseUrl}/links?url=${encodeURIComponent(url)}&cursor=${encodeURIComponent(page.cursor)})`,
    )
  } else {
    lines.push('*End of results.*')
  }

  return lines.join('\n')
}

// ─── Custom Feed ──────────────────────────────────────────────────────────────

export function renderCustomFeed(
  handle: string,
  rkey: string,
  page: FeedPage,
  baseUrl: string,
): string {
  const lines: string[] = []

  lines.push(`# Feed: ${rkey} by [@${handle}](${bskyProfileUrl(handle)})`)
  lines.push('')
  lines.push(
    `[View on Bluesky](https://bsky.app/profile/${handle}/feed/${rkey}) · [Profile](${baseUrl}${apiProfileUrl(handle)})`,
  )

  if (page.posts.length === 0) {
    lines.push(hr())
    lines.push('*No posts in this feed.*')
    return lines.join('\n')
  }

  for (const post of page.posts) {
    lines.push(hr())
    lines.push(renderPostBlock(post))
    lines.push('')
    lines.push(
      `[View post](${baseUrl}${apiPostUrl(post.author.handle, post.rkey)}) · [View thread](${baseUrl}${apiThreadUrl(post.author.handle, post.rkey)}) · [View on Bluesky](${bskyPostUrl(post.author.handle, post.rkey)})`,
    )
  }

  lines.push(hr())

  if (page.cursor) {
    lines.push(
      `[Next page →](${baseUrl}/profile/${handle}/feed/${rkey}?cursor=${encodeURIComponent(page.cursor)})`,
    )
  } else {
    lines.push('*End of feed.*')
  }

  return lines.join('\n')
}

// ─── Trending ─────────────────────────────────────────────────────────────────

export function renderTrending(data: TrendingData, baseUrl: string): string {
  const lines: string[] = []

  lines.push('# Trending on Bluesky')
  lines.push('')
  lines.push(`*${new Date().toUTCString()}*`)
  lines.push('')

  if (data.topics.length === 0) {
    lines.push('*No trending topics available.*')
    return lines.join('\n')
  }

  for (let i = 0; i < data.topics.length; i++) {
    const t = data.topics[i]
    const name = t.displayName || t.topic
    lines.push(`## ${i + 1}. ${name}`)
    lines.push('')
    lines.push(
      `[Search posts](${baseUrl}/search?q=${encodeURIComponent(t.topic)}) · [View on Bluesky](https://bsky.app/search?q=${encodeURIComponent(t.topic)})`,
    )
    if (t.startedAt) {
      lines.push('')
      lines.push(`*Trending since ${formatDate(t.startedAt)}*`)
    }
    if (t.postCount) {
      lines.push(`*${formatNumber(t.postCount)} posts*`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ─── Thread ───────────────────────────────────────────────────────────────────

function renderNestedReplies(replies: NestedReply[], depth = 1): string {
  const lines: string[] = []
  for (const reply of replies) {
    const indent = '> '.repeat(depth)
    const handle = reply.post.author.handle
    const date = formatDate(reply.post.indexedAt)
    const bskyUrl = bskyPostUrl(handle, reply.post.rkey)

    lines.push(`${indent}`)
    lines.push(`${indent}**[@${handle}](${bskyProfileUrl(handle)})** · [${date}](${bskyUrl})`)
    
    const body = richTextToMarkdown(reply.post.text, reply.post.facets)
    if (body.trim()) {
      lines.push(`${indent}`)
      lines.push(body.split('\n').map(l => `${indent}${l}`).join('\n'))
    }

    if (reply.post.embed) {
      const embedMd = renderEmbed(reply.post.embed, reply.post.author.did)
      if (embedMd.trim()) {
        lines.push(`${indent}`)
        lines.push(embedMd.split('\n').map(l => `${indent}${l}`).join('\n'))
      }
    }

    lines.push(`${indent}`)
    lines.push(
      `${indent}💬 ${formatNumber(reply.post.replyCount)} · 🔁 ${formatNumber(reply.post.repostCount)} · ❤️ ${formatNumber(reply.post.likeCount)}`
    )

    if (reply.replies.length > 0) {
      lines.push(renderNestedReplies(reply.replies, depth + 1))
    }
  }
  return lines.join('\n')
}

export function renderThread(thread: ThreadData, baseUrl: string): string {
  const handle = thread.root.author.handle

  if (thread.isReplyThread) {
    const lines: string[] = []

    if (thread.parentChain && thread.parentChain.length > 0) {
      lines.push(`# Thread Context: Reply by [@${handle}](${bskyProfileUrl(handle)})`)
    } else {
      lines.push(`# Thread by [@${handle}](${bskyProfileUrl(handle)})`)
    }
    lines.push('')
    lines.push(
      `[Profile](${baseUrl}${apiProfileUrl(handle)}) · [View on Bluesky](${bskyPostUrl(handle, thread.root.rkey)})`,
    )

    // Render Parent Chain (Context)
    if (thread.parentChain && thread.parentChain.length > 0) {
      lines.push(hr())
      lines.push('## 📜 Context (Parent Posts)')
      lines.push('')

      for (let i = 0; i < thread.parentChain.length; i++) {
        const parent = thread.parentChain[i]
        lines.push(`#### ─── Parent Post (${i + 1} of ${thread.parentChain.length}) ───`)
        lines.push('')
        lines.push(renderPostBlock(parent))
        lines.push('')
        if (i < thread.parentChain.length - 1) {
          lines.push('↓')
          lines.push('')
        }
      }
      lines.push('↓')
    }

    // Render Main Requested Post
    lines.push(hr())
    lines.push('## 🎯 Requested Post')
    lines.push('')
    lines.push(renderPostBlock(thread.root))

    // Render Nested Replies
    if (thread.replyTree && thread.replyTree.length > 0) {
      lines.push(hr())
      lines.push('## 💬 Nested Replies')
      lines.push('')
      lines.push(renderNestedReplies(thread.replyTree, 1))
    }

    lines.push(hr())
    lines.push(
      `*Retrieved via [bsky-markdown-api](${baseUrl})*`,
    )

    return lines.join('\n')
  }

  const lines: string[] = []

  lines.push(`# Thread by [@${handle}](${bskyProfileUrl(handle)})`)
  lines.push('')
  lines.push(
    `[Profile](${baseUrl}${apiProfileUrl(handle)}) · [View on Bluesky](${bskyPostUrl(handle, thread.root.rkey)})`,
  )

  // Root post
  lines.push(hr())
  lines.push(renderPostBlock(thread.root))

  // Replies from same author
  if (thread.replies.length > 0) {
    for (const reply of thread.replies) {
      lines.push(hr())
      lines.push(renderPostBlock(reply))
    }
  }

  lines.push(hr())

  const postCount = 1 + thread.replies.length
  lines.push(
    `*${postCount} post${postCount !== 1 ? 's' : ''} by @${handle} · retrieved via [bsky-markdown-api](${baseUrl})*`,
  )

  return lines.join('\n')
}

export function renderActorLists(handle: string, page: any, baseUrl: string): string {
  const lines: string[] = []
  lines.push(`# Lists by [@${handle}](${bskyProfileUrl(handle)})`)
  lines.push('')
  lines.push(`[Profile](${baseUrl}${apiProfileUrl(handle)})`)
  lines.push('')
  
  if (page.lists.length === 0) {
    lines.push(hr())
    lines.push('*No lists found.*')
    return lines.join('\n')
  }
  
  for (const list of page.lists) {
    lines.push(hr())
    const rkey = list.uri.split('/').at(-1)
    const listUrl = `${baseUrl}/profile/${handle}/list/${rkey}`
    const bskyListUrl = `https://bsky.app/profile/${handle}/lists/${rkey}`
    
    lines.push(`## [${list.name}](${listUrl})`)
    lines.push('')
    if (list.description) {
      lines.push(list.description)
      lines.push('')
    }
    const purpose = list.purpose === 'app.bsky.graph.defs#modlist' ? 'Moderation List' : 'User List'
    lines.push(`*Purpose: ${purpose}*`)
    lines.push('')
    lines.push(`[View List](${listUrl}) · [View on Bluesky](${bskyListUrl})`)
  }
  
  lines.push(hr())
  if (page.cursor) {
    lines.push(`[Next page →](${baseUrl}/profile/${handle}/lists?cursor=${encodeURIComponent(page.cursor)})`)
  } else {
    lines.push('*End of lists.*')
  }
  
  return lines.join('\n')
}

export function renderList(
  handle: string,
  rkey: string,
  page: any,
  baseUrl: string,
): string {
  const list = page.list
  const creator = list.creator
  const lines: string[] = []
  
  lines.push(`# List: ${list.name}`)
  lines.push('')
  if (list.description) {
    lines.push(list.description)
    lines.push('')
  }
  
  lines.push(`**Created by:** [@${creator.handle}](${baseUrl}/profile/${creator.handle})`)
  lines.push('')
  
  lines.push(`## Members (${formatNumber(page.items.length)})`)
  lines.push('')
  
  if (page.items.length === 0) {
    lines.push('*No members in this list.*')
  } else {
    for (const item of page.items) {
      const member = item.subject
      const displayName = member.displayName || member.handle
      lines.push(`- **[${displayName}](${baseUrl}/profile/${member.handle})** · [@${member.handle}](${bskyProfileUrl(member.handle)})`)
      if (member.description) {
        lines.push(`  > ${member.description.split('\n')[0]}`)
      }
    }
  }
  
  lines.push(hr())
  if (page.cursor) {
    lines.push(`[Next page →](${baseUrl}/profile/${handle}/list/${rkey}?cursor=${encodeURIComponent(page.cursor)})`)
  } else {
    lines.push('*End of members.*')
  }
  
  return lines.join('\n')
}

export function renderStarterPack(
  handle: string,
  rkey: string,
  page: any,
  baseUrl: string,
): string {
  const sp = page.starterPack
  const record = sp.record as { name: string; description?: string }
  const creator = sp.creator
  const lines: string[] = []
  
  lines.push(`# Starter Pack: ${record.name}`)
  lines.push('')
  if (record.description) {
    lines.push(record.description)
    lines.push('')
  }
  
  lines.push(`**Created by:** [@${creator.handle}](${baseUrl}/profile/${creator.handle})`)
  if (sp.joinedAllTimeCount !== undefined) {
    lines.push(`**Total Joins:** ${formatNumber(sp.joinedAllTimeCount)}`)
  }
  lines.push('')
  
  lines.push(`## Members (${formatNumber(page.items.length)})`)
  lines.push('')
  
  if (page.items.length === 0) {
    lines.push('*No members found in this starter pack.*')
  } else {
    for (const item of page.items) {
      const member = item.subject
      const displayName = member.displayName || member.handle
      lines.push(`- **[${displayName}](${baseUrl}/profile/${member.handle})** · [@${member.handle}](${bskyProfileUrl(member.handle)})`)
      if (member.description) {
        lines.push(`  > ${member.description.split('\n')[0]}`)
      }
    }
  }
  
  lines.push(hr())
  lines.push(`*Starter Pack retrieved via [bsky-markdown-api](${baseUrl})*`)
  
  return lines.join('\n')
}

export function renderQuotes(
  handle: string,
  rkey: string,
  page: any,
  baseUrl: string,
): string {
  const lines: string[] = []
  
  lines.push(`# Quotes of post by [@${handle}](${bskyProfileUrl(handle)})`)
  lines.push('')
  lines.push(`[Original Post](${baseUrl}/profile/${handle}/post/${rkey}) · [View on Bluesky](${bskyPostUrl(handle, rkey)})`)
  lines.push('')
  
  if (page.posts.length === 0) {
    lines.push(hr())
    lines.push('*No quotes found.*')
    return lines.join('\n')
  }
  
  for (const post of page.posts) {
    lines.push(hr())
    lines.push(renderPostBlock(post))
    lines.push('')
    lines.push(
      `[View post](${baseUrl}${apiPostUrl(post.author.handle, post.rkey)}) · [View thread](${baseUrl}${apiThreadUrl(post.author.handle, post.rkey)}) · [View on Bluesky](${bskyPostUrl(post.author.handle, post.rkey)})`,
    )
  }
  
  lines.push(hr())
  if (page.cursor) {
    lines.push(`[Next page →](${baseUrl}/profile/${handle}/post/${rkey}/quotes?cursor=${encodeURIComponent(page.cursor)})`)
  } else {
    lines.push('*End of quotes.*')
  }
  
  return lines.join('\n')
}

export function renderActivity(
  handle: string,
  page: FeedPage,
  baseUrl: string,
): string {
  const lines: string[] = []
  
  lines.push(`# Activity by [@${handle}](${bskyProfileUrl(handle)})`)
  lines.push('')
  lines.push(
    `[Profile](${baseUrl}${apiProfileUrl(handle)}) · [View on Bluesky](${bskyProfileUrl(handle)})`,
  )
  
  if (page.posts.length === 0) {
    lines.push(hr())
    lines.push('*No activity found.*')
    return lines.join('\n')
  }
  
  for (const post of page.posts) {
    lines.push(hr())
    lines.push(renderPostBlock(post))
    lines.push('')
    lines.push(
      `[View post](${baseUrl}${apiPostUrl(post.author.handle, post.rkey)}) · [View thread](${baseUrl}${apiThreadUrl(post.author.handle, post.rkey)}) · [View on Bluesky](${bskyPostUrl(post.author.handle, post.rkey)})`,
    )
  }
  
  lines.push(hr())
  if (page.cursor) {
    lines.push(`[Next page →](${baseUrl}/profile/${handle}/activity?cursor=${encodeURIComponent(page.cursor)})`)
  } else {
    lines.push('*End of activity.*')
  }
  
  return lines.join('\n')
}

export function renderAlsoLiked(
  handle: string,
  rkey: string,
  posts: PostData[],
  baseUrl: string,
): string {
  const lines: string[] = []
  
  lines.push(`# Posts also liked by people who liked post by [@${handle}](${bskyProfileUrl(handle)})`)
  lines.push('')
  lines.push(`[Original Post](${baseUrl}/profile/${handle}/post/${rkey}) · [View recommendations on foryou.club](https://foryou.club/also-liked?post=https://bsky.app/profile/${handle}/post/${rkey})`)
  lines.push('')
  
  if (posts.length === 0) {
    lines.push(hr())
    lines.push('*No similar liked posts found on foryou.club.*')
    return lines.join('\n')
  }
  
  for (const post of posts) {
    lines.push(hr())
    lines.push(renderPostBlock(post))
    lines.push('')
    lines.push(
      `[View post](${baseUrl}${apiPostUrl(post.author.handle, post.rkey)}) · [View thread](${baseUrl}${apiThreadUrl(post.author.handle, post.rkey)}) · [View on Bluesky](${bskyPostUrl(post.author.handle, post.rkey)})`,
    )
  }
  
  lines.push(hr())
  lines.push('*End of recommendations.*')
  
  return lines.join('\n')
}

export function renderAlsoLikedSection(posts: PostData[], baseUrl: string): string {
  if (posts.length === 0) return ''
  
  const lines: string[] = []
  lines.push('---')
  lines.push('')
  lines.push('## 💖 Also Liked')
  lines.push('')
  lines.push('*Posts that people who liked this post also liked (via [foryou.club](https://foryou.club/also-liked)):*')
  
  for (const post of posts) {
    lines.push(hr())
    lines.push(renderPostBlock(post))
    lines.push('')
    lines.push(
      `[View post](${baseUrl}${apiPostUrl(post.author.handle, post.rkey)}) · [View thread](${baseUrl}${apiThreadUrl(post.author.handle, post.rkey)}) · [View on Bluesky](${bskyPostUrl(post.author.handle, post.rkey)})`,
    )
  }
  
  return lines.join('\n')
}

