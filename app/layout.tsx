import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'summus — summen wird Musik',
  description:
    'Summe eine Melodie, beatboxe einen Beat, bau daraus Loops und einen ganzen Song. summus überträgt deine Stimme auf echte Instrumente.',
}

export const viewport: Viewport = {
  themeColor: '#07070c',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
