'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
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


// ── Catalogue ─────────────────────────────────────────────────────────────────

const ENDPOINTS = [
  { path: '/profile/:handle',            desc: 'Bio, stats, avatar/banner',    example: '/profile/bsky.app' },
  { path: '/profile/:handle/posts',      desc: 'Recent posts (paginated)',      example: '/profile/bsky.app/posts' },
  { path: '/profile/:handle/post/:rkey', desc: 'Single post with embeds',       example: '/profile/bsky.app/post/3lhreomsy5k2x' },
  { path: '/…/post/:rkey/thread',        desc: 'Full self-reply thread',        example: '/profile/bsky.app/post/3lhreomsy5k2x/thread' },
  { path: '/profile/:handle/feed/:rkey', desc: 'Public custom feed',            example: '/profile/bsky.app/feed/whats-hot' },
  { path: '/profile/:handle/likes',      desc: 'Posts the user liked',          example: '/profile/bsky.app/likes' },
  { path: '/profile/:handle/followers',  desc: 'Follower list',                 example: '/profile/bsky.app/followers' },
  { path: '/profile/:handle/following',  desc: 'Following list',                example: '/profile/bsky.app/following' },
  { path: '/search?q=:query',            desc: 'Full-text post search',         example: '/search?q=atproto' },
  { path: '/links?url=:url',             desc: 'Posts linking to a URL/domain', example: '/links?url=theverge.com' },
  { path: '/trending',                   desc: 'Trending topics right now',     example: '/trending' },
  { path: '/llms.txt',                   desc: 'Machine-readable API guide',    example: '/llms.txt' },
]

const QUICK_LINKS = [
  { label: '/trending', path: '/trending' },
  { label: '@bsky.app', path: '/profile/bsky.app' },
  { label: '/feed/whats-hot', path: '/profile/bsky.app/feed/whats-hot' },
  { label: '#atproto', path: '/search?q=%23atproto' },
  { label: 'search:tech', path: '/search?q=tech' },
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
  const [skillMd, setSkillMd] = useState<string | null>(null)
  const [copiedSkill, setCopiedSkill] = useState(false)
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

  const copySkill = useCallback(() => {
    if (!skillMd) return
    navigator.clipboard.writeText(skillMd).then(() => {
      setCopiedSkill(true)
      setTimeout(() => setCopiedSkill(false), 2000)
    })
  }, [skillMd])

  useEffect(() => {
    fetch('/skill.md').then(r => r.text()).then(setSkillMd).catch(() => {})
  }, [])

  const activePath = parsed ? getPath(parsed, parsed.isPost ? viewMode : 'post') : null
  const charCount = markdown ? markdown.length : 0

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.nav}>
          <a href="/" className={s.logo}>
            <span className={s.logoMark} aria-hidden="true">&gt;</span>
            bsky.md
          </a>
          <nav className={s.navLinks}>
            <a href="/trending">Trending</a>
            <a href="/llms.txt">llms.txt</a>
            <a href="/cli">CLI</a>
            <a href="https://tangled.org/j4ck.xyz/bsky-md" target="_blank" rel="noopener noreferrer">
              Source
            </a>
          </nav>
        </div>
      </header>

      <section className={s.hero}>
        <p className={s.kicker}>Terminal-native Bluesky export</p>
        <h1 className={s.title}>Bluesky -&gt; Markdown</h1>
        <p className={s.subtitle}>
          Paste any profile, post, feed, hashtag, or query and return clean plain-text Markdown ready
          for copy, curl, or coding agents.
        </p>

        <div className={s.inputWrapper}>
          <input
            className={s.input}
            type="text"
            placeholder="bsky.app/profile/... | post URL | #hashtag | search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
          {detected && <span className={s.detectedBadge}>{detected.label}</span>}
          <button className={s.convertBtn} onClick={handleConvert}>
            Run
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

      {(loading || markdown !== null || error !== null) && parsed && (
        <section className={s.resultSection} ref={resultRef}>
          <div className={s.resultCard}>
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

            {!loading && markdown && (
              <div className={s.previewToolbar}>
                <span className={s.charCount}>{fmtBytes(charCount)}</span>
                <button
                  className={`${s.actionBtn} ${copiedMd ? s.actionBtnSuccess : ''}`}
                  onClick={copyMarkdown}
                >
                  {copiedMd ? '✓ Copied' : 'Copy Markdown'}
                </button>
              </div>
            )}

            {loading && (
              <div className={s.previewLoading}>
                <span className={s.spinner} />
                Fetching...
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

      <div className={s.infoStrip}>
        <div className={s.infoItem}>
          <span className={s.infoKey}>Auth</span>
          <span className={s.infoValue}>No API key needed</span>
        </div>
        <div className={s.infoItem}>
          <span className={s.infoKey}>CORS</span>
          <span className={s.infoValue}>Open from any origin</span>
        </div>
        <div className={s.infoItem}>
          <span className={s.infoKey}>Cache</span>
          <span className={s.infoValue}>Fast edge responses</span>
        </div>
        <div className={s.infoItem}>
          <span className={s.infoKey}>Format</span>
          <span className={s.infoValue}>LLM-safe plain markdown</span>
        </div>
      </div>

      <section className={s.terminalSection}>
        <p className={s.sectionTitle}>Terminal workflow</p>
        <p className={s.terminalSubtitle}>
          Use <code>curl</code> directly and pipe output to any terminal renderer, script, or coding agent.
        </p>
        <div className={s.terminalBlock}>
          <div className={s.terminalBar}>
            <span className={s.terminalDot} />
            <span className={s.terminalDot} />
            <span className={s.terminalDot} />
          </div>
          <pre className={s.terminalCode}>{[
            '# Profile',
            'curl https://bsky.md/profile/j4ck.xyz',
            '',
            '# Recent posts',
            'curl https://bsky.md/profile/mackuba.eu/posts',
            '',
            '# Followers',
            'curl https://bsky.md/profile/j4ck.xyz/followers',
            '',
            '# Search',
            'curl "https://bsky.md/search?q=atproto"',
            '',
            '# Trending topics',
            'curl https://bsky.md/trending',
            '',
            '# Custom feed',
            'curl https://bsky.md/profile/bsky.app/feed/whats-hot',
            '',
            '# Agent skill file',
            'curl -s https://bsky.md/skill.md > ~/.claude/commands/bsky.md',
          ].join('\n')}</pre>
        </div>
        <p className={s.terminalHint}>
          Tip: requests from terminal clients automatically return Markdown with no additional flags.
        </p>
      </section>

      <section className={s.endpointsSection}>
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

      <section className={s.agentSection}>
        <p className={s.sectionTitle}>Add to your coding agent</p>
        <div className={s.agentCard}>
          <div className={s.agentHeader}>
            <div>
              <p className={s.agentDesc}>
                Copy this skill file into Claude, Cursor, Windsurf, Copilot, or any agent that accepts
                instruction files.
              </p>
              <a
                className={s.agentSkillsLink}
                href="https://agentskills.io/home"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn about agent skills at agentskills.io ↗
              </a>
            </div>
            <button
              className={`${s.skillCopyBtn} ${copiedSkill ? s.skillCopyBtnDone : ''}`}
              onClick={copySkill}
              disabled={!skillMd}
            >
              {copiedSkill ? '✓ Copied' : 'Copy skill.md'}
            </button>
          </div>
          <pre className={s.skillEmbed}>
            {skillMd ?? 'Loading…'}
          </pre>
          <div className={s.agentFooter}>
            <a href="/skill.md" target="_blank" rel="noopener noreferrer" className={s.agentRawLink}>
              View raw ↗
            </a>
            <span className={s.agentFooterHint}>
              or <code>curl -s https://bsky.md/skill.md {'>'} ~/.claude/commands/bsky.md</code> for Claude Code
            </span>
          </div>
        </div>
      </section>

      <footer className={s.footer}>
        <div className={s.footerLinks}>
          <a href="/trending">Trending</a>
          <a href="/llms.txt">llms.txt</a>
          <a href="/docs">API Docs</a>
          <a href="/search?q=atproto">Search</a>
          <a href="https://tangled.org/j4ck.xyz/bsky-md" target="_blank" rel="noopener noreferrer">
            Source on Tangled
          </a>
        </div>
        <p className={s.footerNote}>Content-Type: text/markdown · bsky.md</p>
      </footer>
    </div>
  )
}
