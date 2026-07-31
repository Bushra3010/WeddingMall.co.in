import { SignUpForm } from '@/components/shared/auth-forms'
import { NOINDEX } from '@/lib/seo'

export const metadata = { title: 'Create an account', ...NOINDEX }

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <div className="border-sand-200 rounded-[var(--radius-card)] border bg-white p-6">
      <h1 className="font-display text-sand-900 text-2xl">Create your account</h1>
      <p className="text-sand-600 mt-1 text-sm">
        Save vendors, send enquiries, and track replies in one place.
      </p>

      <div className="mt-6">
        <SignUpForm next={next} />
      </div>
    </div>
  )
}
