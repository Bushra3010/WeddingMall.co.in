import { SignInForm } from '@/components/shared/auth-forms'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Sign in', ...NOINDEX }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams

  return (
    <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-6">
      <h1 className="font-display text-sand-900 text-2xl">Welcome back</h1>
      <p className="text-sand-600 mt-1 text-sm">
        Sign in to manage your shortlist, enquiries, and reviews.
      </p>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
          We could not complete that sign-in link. Please try again.
        </p>
      ) : null}

      <div className="mt-6">
        <SignInForm next={next} />
      </div>
    </div>
  )
}
