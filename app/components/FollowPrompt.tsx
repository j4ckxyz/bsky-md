'use client'

import { useEffect, useState } from 'react'
import s from './FollowPrompt.module.css'

const STORAGE_KEY = 'bsky-md-follow-dismissed'
const CREATOR_DID = 'did:plc:4hawmtgzjx3vclfyphbhfn7v'
const FOLLOW_URL = `https://bsky.app/profile/${CREATOR_DID}`

interface Profile {
  displayName?: string
  handle?: string
  avatar?: string
  followersCount?: number
}

export default function FollowPrompt() {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return
    } catch {
      return
    }
    // Delay so the page loads first
    const t = setTimeout(() => setVisible(true), 1800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible) return
    fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${CREATOR_DID}`,
    )
      .then((r) => r.json())
      .then((d: Profile) => setProfile(d))
      .catch(() => {})
  }, [visible])

  const dismiss = () => {
    setLeaving(true)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setTimeout(() => setVisible(false), 280)
  }

  if (!visible) return null

  const displayName = profile?.displayName || 'jack'
  const handle = profile?.handle || 'j4ck.xyz'

  return (
    <div className={`${s.card} ${leaving ? s.cardLeaving : ''}`} role="complementary" aria-label="Follow the creator">
      <div className={s.strip} />
      <div className={s.body}>
        <div className={s.header}>
          {profile?.avatar ? (
            <img src={profile.avatar} alt={displayName} className={s.avatar} />
          ) : (
            <div className={s.avatarFallback}>🦋</div>
          )}
          <div className={s.info}>
            <div className={s.name}>{displayName}</div>
            <div className={s.handle}>@{handle}</div>
          </div>
          <button className={s.dismiss} onClick={dismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>

        <p className={s.label}>
          Built by jack — follow to hear about updates and new tools.
        </p>

        <a
          href={FOLLOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={s.followBtn}
          onClick={dismiss}
        >
          {/* Bluesky butterfly SVG */}
          <svg className={s.bskyIcon} viewBox="0 0 360 320" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M180 142C180 142 107.5 41.5 54.5 13.5C1.5 -14.5 -11 37.5 9 75C21.5 99 45.5 115.5 45.5 115.5C45.5 115.5 2.5 107.5 0.5 144.5C-1.5 181.5 35 194 75 181C75 181 55 255.5 101.5 280C148 304.5 180 242 180 242C180 242 212 304.5 258.5 280C305 255.5 285 181 285 181C325 194 361.5 181.5 359.5 144.5C357.5 107.5 314.5 115.5 314.5 115.5C314.5 115.5 338.5 99 351 75C371 37.5 358.5 -14.5 305.5 13.5C252.5 41.5 180 142 180 142Z" fill="white"/>
          </svg>
          Follow on Bluesky
        </a>
      </div>
    </div>
  )
}
