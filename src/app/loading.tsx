import { CardSkeleton } from '@/components/ui/states'

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <span className="sr-only" role="status">
        Loading
      </span>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <li key={index}>
            <CardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  )
}
