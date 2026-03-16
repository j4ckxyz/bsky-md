import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'bsky.md — Bluesky as Markdown',
  description:
    'Fetch any public Bluesky profile, post, feed, or search as clean Markdown. No auth, no API key.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦋</text></svg>",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
