export interface ParsedAtUri {
  repo: string
  collection: string
  rkey: string
}

export function isAtUri(str: string): boolean {
  const cleaned = str.trim()
  return (
    cleaned.startsWith('at://') ||
    cleaned.startsWith('at:/') ||
    cleaned.startsWith('at/') ||
    cleaned.startsWith('/at/') ||
    cleaned.startsWith('/at:/') ||
    cleaned.startsWith('/at://') ||
    /^at:\/\/[^\/]+\/[^\/]+\/[^\/]+/.test(cleaned)
  )
}

export function parseAtUri(input: string): ParsedAtUri | null {
  let cleaned = input.trim()
  
  // Strip leading prefixes
  if (cleaned.startsWith('/at://')) {
    cleaned = cleaned.slice(6)
  } else if (cleaned.startsWith('/at:/')) {
    cleaned = cleaned.slice(5)
  } else if (cleaned.startsWith('/at/')) {
    cleaned = cleaned.slice(4)
  } else if (cleaned.startsWith('at://')) {
    cleaned = cleaned.slice(5)
  } else if (cleaned.startsWith('at:/')) {
    cleaned = cleaned.slice(4)
  } else if (cleaned.startsWith('at/')) {
    cleaned = cleaned.slice(3)
  }
  
  const parts = cleaned.split('/').filter(Boolean)
  if (parts.length < 3) return null
  
  const [repo, collection, rkey] = parts
  return { repo, collection, rkey }
}

export function redirectPathForAtUri(uri: string): string | null {
  const parsed = parseAtUri(uri)
  if (!parsed) return null
  
  const { repo, collection, rkey } = parsed
  
  switch (collection) {
    case 'app.bsky.feed.post':
      return `/profile/${repo}/post/${rkey}`
    case 'app.bsky.feed.generator':
      return `/profile/${repo}/feed/${rkey}`
    case 'app.bsky.graph.list':
      return `/profile/${repo}/list/${rkey}`
    case 'app.bsky.graph.starterpack':
      return `/profile/${repo}/starter-pack/${rkey}`
    default:
      // Return a general route for other/unknown collections
      return `/profile/${repo}`
  }
}
