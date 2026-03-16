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
          {/* Bluesky icon */}
          <svg className={s.bskyIcon} xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 30.56 512 450.84" aria-hidden="true">
            <path d="M111 60.9c58.7 44.1 121.8 133.4 145 181.4 23.2-47.9 86.3-137.3 145-181.4 42.4-31.8 111-56.4 111 21.9 0 15.6-9 131.3-14.2 150.1-18.3 65.3-84.9 82-144.1 71.9 103.5 17.6 129.9 76 73 134.4-108 110.9-155.3-27.8-167.4-63.4-2.2-6.5-3.3-9.6-3.3-7 0-2.6-1.1.5-3.3 7-12.1 35.5-59.4 174.2-167.4 63.4-56.9-58.4-30.5-116.8 73-134.4-59.2 10.1-125.8-6.5-144.1-71.8C9 214.2 0 98.5 0 82.8 0 4.5 68.6 29.1 111 60.9" fill="white"/>
          </svg>
          Follow on Bluesky
        </a>
      </div>
    </div>
  )
}
