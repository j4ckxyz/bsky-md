import type { Metadata } from 'next'
import './globals.css'

const BASE = 'https://bsky.md'

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
        url: `${BASE}/og-card.png`,
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
    images: [`${BASE}/og-card.png`],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeInitScript = `
    (() => {
      try {
        const key = 'bsky-md-theme';
        const value = localStorage.getItem(key);
        if (value === 'dark' || value === 'light') {
          document.documentElement.setAttribute('data-theme', value);
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      } catch {
        document.documentElement.removeAttribute('data-theme');
      }
    })();
  `

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
