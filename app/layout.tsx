import type { Metadata } from 'next'
import './globals.css'
import FollowPrompt from './components/FollowPrompt'

const BASE = 'https://bsky-md.vercel.app'

export const metadata: Metadata = {
  title: 'bsky.md — Bluesky as Markdown',
  description:
    'Fetch any public Bluesky profile, post, feed, or search as clean Markdown. No auth, no API key.',
  metadataBase: new URL(BASE),
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦋</text></svg>",
  },
  openGraph: {
    title: 'bsky.md — Bluesky as Markdown',
    description: 'Fetch any public Bluesky content as clean, portable Markdown. No auth, no API key.',
    url: BASE,
    siteName: 'bsky.md',
    images: [
      {
        url: `${BASE}/og.png`,
        width: 1200,
        height: 630,
        alt: 'bsky.md — Bluesky as Markdown',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'bsky.md — Bluesky as Markdown',
    description: 'Fetch any public Bluesky content as clean, portable Markdown. No auth, no API key.',
    images: [`${BASE}/og.png`],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <FollowPrompt />
      </body>
    </html>
  )
}
