import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'bsky.md — Bluesky as Markdown',
  description:
    'Fetch any public Bluesky profile, post, feed, or search as clean Markdown. No auth, no API key.',
  icons: { icon: '/icon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
