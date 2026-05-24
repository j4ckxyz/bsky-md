'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import s from './page.module.css'
import FollowPrompt from './components/FollowPrompt'

type ThemeSetting = 'system' | 'dark' | 'light'

const THEME_KEY = 'bsky-md-theme'

function isThemeSetting(value: string | null): value is ThemeSetting {
  return value === 'system' || value === 'dark' || value === 'light'
}

function getStoredThemeSetting(): ThemeSetting {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (isThemeSetting(stored)) return stored
  } catch {
    // no-op
  }
  return 'system'
}

function applyThemeSetting(setting: ThemeSetting) {
  const root = document.documentElement
  if (setting === 'system') {
    root.removeAttribute('data-theme')
    return
  }
  root.setAttribute('data-theme', setting)
}

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
    const hostname = url.hostname.toLowerCase()

    const isBskyApp = ['bsky.app', 'www.bsky.app', 'staging.bsky.app'].includes(hostname)
    const isLocalOrBsmd = hostname.endsWith('bsky.md') || hostname.includes('localhost') || hostname.includes('127.0.0.1')

    if (isBskyApp || isLocalOrBsmd) {
      const p = url.pathname.split('/').filter(Boolean)

      if (p.length === 0) return { path: '/trending', label: 'Trending', isPost: false }

      if (p[0] === 'profile' && p[1]) {
        const h = p[1]
        if (p.length === 2) return { path: `/profile/${h}`, label: 'Profile', isPost: false }
        if (p[2] === 'post' && p[3]) {
          const sub = p[4]?.toLowerCase()
          const label = sub === 'also-liked' ? 'Also Liked' : sub === 'quotes' ? 'Quotes' : sub === 'thread' ? 'Thread' : 'Post'
          return { path: url.pathname, label, isPost: true }
        }
        if (p[2] === 'feed' && p[3]) return { path: `/profile/${h}/feed/${p[3]}`, label: 'Feed', isPost: false }
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

// ── Category detection & Tab constants ────────────────────────────────────────

type QueryCategory =
  | 'profile'
  | 'post'
  | 'list'
  | 'starter-pack'
  | 'feed'
  | 'search'
  | 'trending'
  | 'links'
  | 'utility'

interface CategoryDetection {
  category: QueryCategory
  basePath: string
  defaultView: string
}

function detectQueryCategory(path: string): CategoryDetection {
  const cleanPath = path.split('?')[0] // remove query string
  const p = cleanPath.split('/').filter(Boolean)

  if (p[0] === 'profile' && p[1]) {
    const handle = p[1]
    
    // 1. Post Check
    if (p[2] === 'post' && p[3]) {
      const rkey = p[3]
      const basePath = `/profile/${handle}/post/${rkey}`
      let defaultView = 'thread'
      if (p[4]) {
        const sub = p[4].toLowerCase()
        if (['single', 'thread', 'quotes', 'also-liked'].includes(sub)) {
          defaultView = sub
        }
      }
      return { category: 'post', basePath, defaultView }
    }
    
    // 2. Custom Feed Check
    if (p[2] === 'feed' && p[3]) {
      return { category: 'feed', basePath: `/profile/${handle}/feed/${p[3]}`, defaultView: 'default' }
    }

    // 3. List Detail Check
    if (p[2] === 'list' && p[3]) {
      return { category: 'list', basePath: `/profile/${handle}/list/${p[3]}`, defaultView: 'default' }
    }

    // 4. Starter Pack Check
    if (p[2] === 'starter-pack' && p[3]) {
      return { category: 'starter-pack', basePath: `/profile/${handle}/starter-pack/${p[3]}`, defaultView: 'default' }
    }

    // 5. Profile views
    const basePath = `/profile/${handle}`
    let defaultView = 'bio'
    if (p[2]) {
      const sub = p[2].toLowerCase()
      if (['posts', 'activity', 'followers', 'following', 'lists'].includes(sub)) {
        defaultView = sub
      }
    }
    return { category: 'profile', basePath, defaultView }
  }

  // 6. Search
  if (path.startsWith('/search')) {
    return { category: 'search', basePath: path, defaultView: 'default' }
  }

  // 7. Links
  if (path.startsWith('/links')) {
    return { category: 'links', basePath: path, defaultView: 'default' }
  }

  // 8. Trending
  if (path.startsWith('/trending')) {
    return { category: 'trending', basePath: '/trending', defaultView: 'default' }
  }

  // Utility / AT-URI
  return { category: 'utility', basePath: path, defaultView: 'default' }
}

interface TabDefinition {
  id: string
  label: string
  pathSuffix: string
}

const TABS_BY_CATEGORY: Record<string, TabDefinition[]> = {
  profile: [
    { id: 'bio', label: 'Profile Bio', pathSuffix: '' },
    { id: 'posts', label: 'Recent Posts', pathSuffix: '/posts' },
    { id: 'activity', label: 'Activity Timeline', pathSuffix: '/activity' },
    { id: 'lists', label: 'Public Lists', pathSuffix: '/lists' },
    { id: 'followers', label: 'Followers', pathSuffix: '/followers' },
    { id: 'following', label: 'Following', pathSuffix: '/following' },
  ],
  post: [
    { id: 'thread', label: 'Full Thread', pathSuffix: '/thread' },
    { id: 'single', label: 'Single Post', pathSuffix: '/single' },
    { id: 'quotes', label: 'Quotes', pathSuffix: '/quotes' },
    { id: 'also-liked', label: 'Also Liked', pathSuffix: '/also-liked' },
  ],
}

// ── Catalogue ─────────────────────────────────────────────────────────────────

const ENDPOINTS = [
  { path: '/profile/:handle',            desc: 'Bio, stats, avatar/banner',    example: '/profile/bsky.app', category: 'profile' },
  { path: '/profile/:handle/posts',      desc: 'Recent posts (paginated)',      example: '/profile/bsky.app/posts', category: 'profile' },
  { path: '/profile/:handle/post/:rkey', desc: 'Post with parents/replies context by default if a reply', example: '/profile/bsky.app/post/3lhreomsy5k2x', category: 'post' },
  { path: '/…/post/:rkey/single',        desc: 'Single post itself without parent/reply context', example: '/profile/bsky.app/post/3lhreomsy5k2x/single', category: 'post' },
  { path: '/…/post/:rkey/thread',        desc: 'Full self-reply thread',        example: '/profile/bsky.app/post/3lhreomsy5k2x/thread', category: 'post' },
  { path: '/…/post/:rkey/quotes',        desc: 'Posts that quote this post (quotes/reposts)', example: '/profile/spacecowboy17.bsky.social/post/3lhreomsy5k2x/quotes', category: 'post' },
  { path: '/…/post/:rkey/also-liked',    desc: 'Posts that people who liked this post also liked', example: '/profile/spacecowboy17.bsky.social/post/3lhreomsy5k2x/also-liked', category: 'post' },
  { path: '/profile/:handle/activity',   desc: 'Combined activity timeline of posts & replies', example: '/profile/bsky.app/activity', category: 'profile' },
  { path: '/profile/:handle/feed/:rkey', desc: 'Public custom feed',            example: '/profile/bsky.app/feed/whats-hot', category: 'feed' },
  { path: '/profile/:handle/followers',  desc: 'Follower list',                 example: '/profile/bsky.app/followers', category: 'social' },
  { path: '/profile/:handle/following',  desc: 'Following list',                example: '/profile/bsky.app/following', category: 'social' },
  { path: '/profile/:handle/lists',      desc: 'Public lists created by handle', example: '/profile/bsky.app/lists', category: 'list' },
  { path: '/profile/:handle/list/:rkey', desc: 'Details and members of a specific list', example: '/profile/bsky.app/list/3lhr7u7k2s22b', category: 'list' },
  { path: '/profile/:handle/starter-pack/:rkey', desc: 'Starter pack details and members', example: '/profile/bsky.app/starter-pack/3lhreomsy5k2x', category: 'pack' },
  { path: '/search?q=:query',            desc: 'Full-text post search',         example: '/search?q=atproto', category: 'search' },
  { path: '/links?url=:url',             desc: 'Posts linking to a URL/domain', example: '/links?url=theverge.com', category: 'search' },
  { path: '/trending',                   desc: 'Trending topics right now',     example: '/trending', category: 'search' },
  { path: '/at/:atUri',                  desc: 'AT-URI resolver & redirection', example: '/at/at://did:plc:z72hi547mmus2cej7g7cctoi/app.bsky.feed.post/3lhreomsy5k2x', category: 'utility' },
  { path: '/llms.txt',                   desc: 'Machine-readable API guide',    example: '/llms.txt', category: 'utility' },
]

const QUICK_LINKS = [
  { label: '--trending', path: '/trending' },
  { label: '@bsky.app', path: '/profile/bsky.app' },
  { label: '--feed/whats-hot', path: '/profile/bsky.app/feed/whats-hot' },
  { label: '#atproto', path: '/search?q=%23atproto' },
  { label: '--search/tech', path: '/search?q=tech' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [theme, setTheme] = useState<ThemeSetting>('system')
  const [viewMode, setViewMode] = useState<string>('thread')
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
  const canRun = input.trim().length > 0 && !loading

  const getPath = useCallback((p: Parsed, mode: string) => {
    const { category, basePath } = detectQueryCategory(p.path)
    
    if (category === 'profile') {
      if (mode === 'bio') return basePath
      if (['posts', 'activity', 'followers', 'following', 'lists'].includes(mode)) {
        return `${basePath}/${mode}`
      }
    }
    
    if (category === 'post') {
      if (mode === 'single') return `${basePath}/single`
      if (['thread', 'quotes', 'also-liked'].includes(mode)) {
        return `${basePath}/${mode}`
      }
    }
    
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

  const handleConvert = useCallback(() => {
    if (loading) return
    const p = parseBskyInput(input)
    if (!p) return

    const { category, basePath, defaultView } = detectQueryCategory(p.path)
    const cleanParsed = { ...p, path: basePath }

    setViewMode(defaultView)
    setParsed(cleanParsed)
    fetchMd(getPath(cleanParsed, defaultView))
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
  }, [input, fetchMd, getPath, loading])

  const handleQuick = useCallback(
    (path: string) => {
      setInput(path)
      const p = parseBskyInput(path)
      if (!p) return

      const { category, basePath, defaultView } = detectQueryCategory(p.path)
      const cleanParsed = { ...p, path: basePath }

      setViewMode(defaultView)
      setParsed(cleanParsed)
      fetchMd(getPath(cleanParsed, defaultView))
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
    },
    [fetchMd, getPath],
  )

  const handleViewToggle = useCallback(
    (mode: string) => {
      setViewMode(mode)
      if (parsed) fetchMd(getPath(parsed, mode))
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

  useEffect(() => {
    const stored = getStoredThemeSetting()
    setTheme(stored)
    applyThemeSetting(stored)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const active = document.activeElement
        if (
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.getAttribute('contenteditable') === 'true')
        ) {
          return
        }
        e.preventDefault()
        const inputEl = document.getElementById('bsky-input')
        if (inputEl) {
          (inputEl as HTMLInputElement).focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const setThemePreference = useCallback((next: ThemeSetting) => {
    setTheme(next)
    applyThemeSetting(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // no-op
    }
  }, [])

  const cycleTheme = useCallback(() => {
    const nextTheme: ThemeSetting = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system'
    setThemePreference(nextTheme)
  }, [theme, setThemePreference])

  const activePath = parsed ? getPath(parsed, viewMode) : null
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

        <label htmlFor="bsky-input" className={s.inputLabel}>
          Bluesky URL, handle, hashtag, or search query
        </label>
        <div className={s.inputWrapper}>
          <div className={s.inputGroup}>
            <input
              id="bsky-input"
              className={s.input}
              type="text"
              placeholder="bsky.app/profile/... | post URL | #hashtag | search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
            {!focused && !input && (
              <span className={s.shortcutHint} aria-hidden="true">
                /
              </span>
            )}
            {input && (
              <button
                type="button"
                className={s.clearBtn}
                onClick={() => {
                  setInput('')
                  document.getElementById('bsky-input')?.focus()
                }}
                aria-label="Clear input"
              >
                ✕
              </button>
            )}
            {detected && (
              <span className={`${s.detectedBadge} ${input ? s.badgeShifted : ''}`}>
                {detected.label}
              </span>
            )}
          </div>
          <button type="button" className={s.convertBtn} onClick={handleConvert} disabled={!canRun}>
            {loading ? 'Running' : 'Run'}
          </button>
        </div>

        <div className={s.pills}>
          {QUICK_LINKS.map((ql) => (
            <button type="button" key={ql.path} className={s.pill} onClick={() => handleQuick(ql.path)}>
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
              <code className={s.resultUrl}>
                <span className={s.promptSymbol} aria-hidden="true">$</span>{activePath}
              </code>
              <div className={s.resultActions}>
                <button
                  type="button"
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

            {(() => {
              const { category } = detectQueryCategory(parsed.path)
              const tabs = TABS_BY_CATEGORY[category]
              if (!tabs || tabs.length === 0) return null
              return (
                <div className={s.toggle}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`${s.toggleBtn} ${viewMode === tab.id ? s.toggleActive : ''}`}
                      onClick={() => handleViewToggle(tab.id)}
                      aria-pressed={viewMode === tab.id}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )
            })()}

            {!loading && markdown && (
              <div className={s.previewToolbar}>
                <span className={s.charCount}>{fmtBytes(charCount)}</span>
                <button
                  type="button"
                  className={`${s.actionBtn} ${copiedMd ? s.actionBtnSuccess : ''}`}
                  onClick={copyMarkdown}
                >
                  {copiedMd ? '✓ Copied' : 'Copy Markdown'}
                </button>
              </div>
            )}

            {loading && (
              <div className={s.previewLoading} role="status" aria-live="polite">
                <span className={s.spinner} />
                Fetching...
              </div>
            )}
            {!loading && error && (
              <pre className={`${s.preview} ${s.previewError}`} role="alert">{error}</pre>
            )}
            {!loading && markdown && (
              <pre className={`${s.preview} ${s.fadeIn}`}>{markdown}</pre>
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
        <h2 className={s.sectionTitle}>Terminal workflow</h2>
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
        <h2 className={s.sectionTitle}>All Endpoints</h2>
        <div className={s.grid}>
          {ENDPOINTS.map((ep, idx) => (
            <a key={ep.path} className={s.card} data-category={ep.category} href={ep.example} target="_blank" rel="noopener noreferrer">
              <div className={s.cardHeader}>
                <span className={s.cardBadge}>GET</span>
                <span className={s.cardIndex}>{(idx + 1).toString().padStart(2, '0')}</span>
              </div>
              <code className={s.cardPath}>{ep.path}</code>
              <p className={s.cardDesc}>{ep.desc}</p>
            </a>
          ))}
        </div>
      </section>

      <section className={s.agentSection}>
        <h2 className={s.sectionTitle}>Add to your coding agent</h2>
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
              type="button"
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
          <button
            type="button"
            className={s.footerThemeBtn}
            onClick={cycleTheme}
            aria-label={`Cycle theme (currently ${theme})`}
            title={`Cycle theme (currently ${theme})`}
          >
            {theme === 'system' && (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2v20A10 10 0 0 0 12 2z" fill="currentColor" />
                </svg>
                Auto
              </>
            )}
            {theme === 'dark' && (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" />
                </svg>
                Dark
              </>
            )}
            {theme === 'light' && (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <circle cx="12" cy="12" r="4" fill="currentColor" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="M4.93 4.93l1.41 1.41" />
                  <path d="M17.66 17.66l1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="M6.34 17.66l-1.41 1.41" />
                  <path d="M19.07 4.93l-1.41 1.41" />
                </svg>
                Light
              </>
            )}
          </button>
        </div>
        <p className={s.footerNote}>Content-Type: text/markdown · bsky.md</p>
      </footer>

      <FollowPrompt />
    </div>
  )
}
