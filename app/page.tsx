'use client'

import { useState, useCallback, useRef } from 'react'
import s from './page.module.css'

// ── URL parser ────────────────────────────────────────────────────────────────

interface Parsed {
  path: string
  label: string
  isPost: boolean
}

function parseBskyInput(raw: string): Parsed | null {
  const input = raw.trim()
  if (!input) return null

  try {
    const urlStr = /^https?:\/\//i.test(input) ? input : `https://${input}`
    const url = new URL(urlStr)

    if (['bsky.app', 'www.bsky.app', 'staging.bsky.app'].includes(url.hostname)) {
      const p = url.pathname.split('/').filter(Boolean)

      if (p.length === 0) return { path: '/trending', label: 'Trending', isPost: false }

      if (p[0] === 'profile' && p[1]) {
        const h = p[1]
        if (p.length === 2) return { path: `/profile/${h}`, label: 'Profile', isPost: false }
        if (p[2] === 'post' && p[3]) return { path: `/profile/${h}/post/${p[3]}`, label: 'Post', isPost: true }
        if (p[2] === 'feed' && p[3]) return { path: `/profile/${h}/feed/${p[3]}`, label: 'Feed', isPost: false }
        if (p[2] === 'likes') return { path: `/profile/${h}/likes`, label: 'Likes', isPost: false }
        if (p[2] === 'followers') return { path: `/profile/${h}/followers`, label: 'Followers', isPost: false }
        if (p[2] === 'following') return { path: `/profile/${h}/following`, label: 'Following', isPost: false }
        return { path: `/profile/${h}`, label: 'Profile', isPost: false }
      }

      if (p[0] === 'hashtag' && p[1])
        return { path: `/search?q=${encodeURIComponent('#' + p[1])}`, label: 'Hashtag', isPost: false }

      if (p[0] === 'search') {
        const q = url.searchParams.get('q') ?? ''
        return { path: `/search?q=${encodeURIComponent(q)}`, label: 'Search', isPost: false }
      }

      if (p[0] === 'trending')
        return { path: '/trending', label: 'Trending', isPost: false }
    }
  } catch {
    // not a URL
  }

  if (input.startsWith('did:'))
    return { path: `/profile/${input}`, label: 'Profile', isPost: false }

  if (input.startsWith('#'))
    return { path: `/search?q=${encodeURIComponent(input)}`, label: 'Hashtag', isPost: false }

  if (/^[\w.-]+$/.test(input) && input.includes('.'))
    return { path: `/profile/${input}`, label: 'Profile', isPost: false }

  return { path: `/search?q=${encodeURIComponent(input)}`, label: 'Search', isPost: false }
}

function fmtBytes(n: number): string {
  if (n < 1000) return `${n} chars`
  return `${(n / 1000).toFixed(1)}k chars`
}

// ── Agent install data ────────────────────────────────────────────────────────

const AGENTS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    icon: '🤖',
    command: 'curl -s https://bsky-md.vercel.app/skill.md > ~/.claude/commands/bsky.md',
    desc: 'Installs a global /bsky slash command. Use it in any Claude Code session with /bsky.',
    note: 'After running, type <code>/bsky</code> in any Claude Code conversation to activate.',
  },
  {
    id: 'claude-md',
    label: 'CLAUDE.md',
    icon: '📄',
    command: 'curl -s https://bsky-md.vercel.app/skill.md >> CLAUDE.md',
    desc: 'Appends the full API reference to your project\'s CLAUDE.md — Claude will use it automatically for every conversation in this project.',
    note: 'Run this in your project root. Works for Claude Code, Cursor, and any agent that reads CLAUDE.md.',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    icon: '⌨️',
    command: 'curl -s https://bsky-md.vercel.app/skill.md >> .cursorrules',
    desc: 'Appends the API reference to your Cursor project rules.',
    note: 'Cursor reads .cursorrules automatically for every chat in this workspace.',
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    icon: '🏄',
    command: 'curl -s https://bsky-md.vercel.app/skill.md >> .windsurfrules',
    desc: 'Appends the API reference to your Windsurf workspace rules.',
    note: 'Windsurf reads .windsurfrules for every Cascade conversation in this workspace.',
  },
  {
    id: 'copilot',
    label: 'Copilot',
    icon: '🐙',
    command: 'mkdir -p .github && curl -s https://bsky-md.vercel.app/skill.md >> .github/copilot-instructions.md',
    desc: 'Appends the API reference to your GitHub Copilot workspace instructions.',
    note: 'GitHub Copilot reads .github/copilot-instructions.md automatically.',
  },
  {
    id: 'raw',
    label: 'Raw file',
    icon: '📋',
    command: 'curl -s https://bsky-md.vercel.app/skill.md',
    desc: 'Print the raw skill file — paste it into any agent context, system prompt, or rules file.',
    note: 'Or just open <a href="/skill.md" target="_blank" rel="noopener noreferrer">bsky-md.vercel.app/skill.md</a> in your browser.',
  },
]

// ── Catalogue ─────────────────────────────────────────────────────────────────

const ENDPOINTS = [
  { path: '/profile/:handle',            desc: 'Bio, stats, avatar/banner',    example: '/profile/bsky.app' },
  { path: '/profile/:handle/posts',      desc: 'Paginated original posts',      example: '/profile/bsky.app/posts' },
  { path: '/profile/:handle/post/:rkey', desc: 'Single post with embeds',       example: '/profile/bsky.app/post/3lhreomsy5k2x' },
  { path: '/…/post/:rkey/thread',        desc: 'Full self-reply thread',        example: '/profile/bsky.app/post/3lhreomsy5k2x/thread' },
  { path: '/profile/:handle/feed/:rkey', desc: 'Public custom feed',            example: '/profile/bsky.app/feed/whats-hot' },
  { path: '/profile/:handle/likes',      desc: 'Posts the user liked',          example: '/profile/bsky.app/likes' },
  { path: '/profile/:handle/followers',  desc: 'Follower list',                 example: '/profile/bsky.app/followers' },
  { path: '/profile/:handle/following',  desc: 'Following list',                example: '/profile/bsky.app/following' },
  { path: '/search?q=:query',            desc: 'Full-text post search',         example: '/search?q=atproto' },
  { path: '/trending',                   desc: 'Trending topics right now',     example: '/trending' },
  { path: '/llms.txt',                   desc: 'Machine-readable API guide',    example: '/llms.txt' },
]

const QUICK_LINKS = [
  { label: '🔥 Trending',     path: '/trending' },
  { label: '👤 bsky.app',     path: '/profile/bsky.app' },
  { label: '🌐 What\'s Hot',  path: '/profile/bsky.app/feed/whats-hot' },
  { label: '#atproto',        path: '/search?q=%23atproto' },
  { label: '📰 Tech',         path: '/search?q=tech' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [viewMode, setViewMode] = useState<'post' | 'thread'>('thread')
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedMd, setCopiedMd] = useState(false)
  const [activeAgent, setActiveAgent] = useState('claude-code')
  const [copiedCmd, setCopiedCmd] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)

  // Live type detection as user types
  const detected = input.trim() ? parseBskyInput(input) : null

  const getPath = useCallback((p: Parsed, mode: 'post' | 'thread') => {
    if (p.isPost && mode === 'thread') return p.path + '/thread'
    return p.path
  }, [])

  const fetchMd = useCallback(async (apiPath: string) => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    setMarkdown(null)
    try {
      const res = await fetch(apiPath, { signal: ctrl.signal })
      const text = await res.text()
      if (!res.ok) setError(text)
      else setMarkdown(text)
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const run = useCallback(
    (p: Parsed, mode: 'post' | 'thread') => {
      setParsed(p)
      fetchMd(getPath(p, mode))
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
    },
    [fetchMd, getPath],
  )

  const handleConvert = useCallback(() => {
    const p = parseBskyInput(input)
    if (!p) return
    run(p, viewMode)
  }, [input, viewMode, run])

  const handleQuick = useCallback(
    (path: string) => {
      setInput(path)
      run({ path, label: 'Quick', isPost: false }, 'post')
    },
    [run],
  )

  const handleViewToggle = useCallback(
    (mode: 'post' | 'thread') => {
      setViewMode(mode)
      if (parsed?.isPost) fetchMd(getPath(parsed, mode))
    },
    [parsed, fetchMd, getPath],
  )

  const copyUrl = useCallback(() => {
    if (!parsed) return
    const full = (typeof window !== 'undefined' ? window.location.origin : '') + getPath(parsed, viewMode)
    navigator.clipboard.writeText(full).then(() => {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    })
  }, [parsed, viewMode, getPath])

  const copyMarkdown = useCallback(() => {
    if (!markdown) return
    navigator.clipboard.writeText(markdown).then(() => {
      setCopiedMd(true)
      setTimeout(() => setCopiedMd(false), 2000)
    })
  }, [markdown])

  const copyCmd = useCallback((cmd: string) => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopiedCmd(true)
      setTimeout(() => setCopiedCmd(false), 2000)
    })
  }, [])

  const activePath = parsed ? getPath(parsed, parsed.isPost ? viewMode : 'post') : null
  const currentAgent = AGENTS.find((a) => a.id === activeAgent) ?? AGENTS[0]
  const charCount = markdown ? markdown.length : 0

  return (
    <div className={s.page}>
      {/* ── Header ── */}
      <header className={s.header}>
        <div className={s.nav}>
          <a href="/" className={s.logo}>
            🦋 bsky.md
          </a>
          <nav className={s.navLinks}>
            <a href="/trending">Trending</a>
            <a href="/llms.txt">llms.txt</a>
            <a href="https://tangled.org/j4ck.xyz/bsky-md" target="_blank" rel="noopener noreferrer">
              Source
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className={s.hero}>
        <h1 className={s.title}>Bluesky, as Markdown.</h1>
        <p className={s.subtitle}>
          Paste any bsky.app URL — profile, post, feed, search, or hashtag — and get back clean,
          portable Markdown instantly.
        </p>

        <div className={s.inputWrapper}>
          <input
            className={s.input}
            type="text"
            placeholder="bsky.app/profile/...  ·  post URL  ·  #hashtag  ·  search term"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
          {detected && <span className={s.detectedBadge}>{detected.label}</span>}
          <button className={s.convertBtn} onClick={handleConvert}>
            Convert →
          </button>
        </div>

        <div className={s.pills}>
          {QUICK_LINKS.map((ql) => (
            <button key={ql.path} className={s.pill} onClick={() => handleQuick(ql.path)}>
              {ql.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Result ── */}
      {(loading || markdown !== null || error !== null) && parsed && (
        <section className={s.resultSection} ref={resultRef}>
          <div className={s.resultCard}>

            {/* Top bar: label · url · copy url · open */}
            <div className={s.resultBar}>
              <span className={s.resultLabel}>{parsed.label}</span>
              <code className={s.resultUrl}>{activePath}</code>
              <div className={s.resultActions}>
                <button
                  className={`${s.actionBtn} ${copiedUrl ? s.actionBtnSuccess : ''}`}
                  onClick={copyUrl}
                >
                  {copiedUrl ? '✓ Copied' : 'Copy URL'}
                </button>
                <a
                  className={s.actionBtn}
                  href={activePath ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Raw ↗
                </a>
              </div>
            </div>

            {/* Post / Thread toggle */}
            {parsed.isPost && (
              <div className={s.toggle}>
                <button
                  className={`${s.toggleBtn} ${viewMode === 'thread' ? s.toggleActive : ''}`}
                  onClick={() => handleViewToggle('thread')}
                >
                  Full Thread
                </button>
                <button
                  className={`${s.toggleBtn} ${viewMode === 'post' ? s.toggleActive : ''}`}
                  onClick={() => handleViewToggle('post')}
                >
                  Single Post
                </button>
              </div>
            )}

            {/* Preview toolbar */}
            {!loading && markdown && (
              <div className={s.previewToolbar}>
                <span className={s.charCount}>{fmtBytes(charCount)}</span>
                <button
                  className={`${s.actionBtn} ${copiedMd ? s.actionBtnSuccess : ''}`}
                  onClick={copyMarkdown}
                >
                  {copiedMd ? '✓ Copied!' : '📋 Copy Markdown'}
                </button>
              </div>
            )}

            {/* Content */}
            {loading && (
              <div className={s.previewLoading}>
                <span className={s.spinner} />
                Fetching…
              </div>
            )}
            {!loading && error && (
              <pre className={`${s.preview} ${s.previewError}`}>{error}</pre>
            )}
            {!loading && markdown && (
              <pre className={s.preview}>{markdown}</pre>
            )}
          </div>
        </section>
      )}

      {/* ── Info strip ── */}
      <div className={s.infoStrip} style={{ marginTop: 32 }}>
        <div className={s.infoItem}><span className={s.infoIcon}>🔓</span> No auth or API key</div>
        <div className={s.infoItem}><span className={s.infoIcon}>🌍</span> Open CORS from any origin</div>
        <div className={s.infoItem}><span className={s.infoIcon}>⚡</span> Edge-cached responses</div>
        <div className={s.infoItem}><span className={s.infoIcon}>🤖</span> LLM-friendly plain text</div>
      </div>

      {/* ── Endpoints ── */}
      <section className={s.endpointsSection} style={{ marginTop: 48 }}>
        <p className={s.sectionTitle}>All Endpoints</p>
        <div className={s.grid}>
          {ENDPOINTS.map((ep) => (
            <a key={ep.path} className={s.card} href={ep.example} target="_blank" rel="noopener noreferrer">
              <span className={s.cardBadge}>GET</span>
              <code className={s.cardPath}>{ep.path}</code>
              <p className={s.cardDesc}>{ep.desc}</p>
            </a>
          ))}
        </div>
      </section>

      {/* ── Agent install ── */}
      <section className={s.agentSection}>
        <p className={s.sectionTitle}>Add to your coding agent</p>
        <div className={s.agentCard}>
          {/* Tab row */}
          <div className={s.agentTabs}>
            {AGENTS.map((a) => (
              <button
                key={a.id}
                className={`${s.agentTab} ${activeAgent === a.id ? s.agentTabActive : ''}`}
                onClick={() => { setActiveAgent(a.id); setCopiedCmd(false) }}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className={s.agentBody}>
            <p className={s.agentDesc}>{currentAgent.desc}</p>
            <div className={s.codeBlock}>
              <code className={s.codeText}>$ {currentAgent.command}</code>
              <button
                className={`${s.codeCopy} ${copiedCmd ? s.codeCopyDone : ''}`}
                onClick={() => copyCmd(currentAgent.command)}
              >
                {copiedCmd ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p
              className={s.agentNote}
              dangerouslySetInnerHTML={{ __html: currentAgent.note }}
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={s.footer} style={{ marginTop: 64 }}>
        <div className={s.footerLinks}>
          <a href="/trending">Trending</a>
          <a href="/llms.txt">llms.txt</a>
          <a href="/docs">API Docs</a>
          <a href="/search?q=atproto">Search</a>
          <a href="https://tangled.org/j4ck.xyz/bsky-md" target="_blank" rel="noopener noreferrer">
            Source on Tangled
          </a>
        </div>
        <p className={s.footerNote}>Content-Type: text/markdown · bsky-md.vercel.app</p>
      </footer>
    </div>
  )
}
