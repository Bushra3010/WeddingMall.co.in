import Link from 'next/link'

import { site } from '@/lib/site'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-sand-100 flex min-h-dvh flex-col">
      <header className="p-6">
        <Link href="/" className="font-display text-brand-800 text-xl font-semibold">
          {site.name}
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
