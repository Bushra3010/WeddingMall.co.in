'use client'

import { FormMessage, fieldError, useAction } from '@/components/shared/action-form'
import { SubmitButton } from '@/components/shared/submit-button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { savePageAction, savePostAction } from '@/features/cms/content-actions'

/**
 * Content editor (PRD 6.11).
 *
 * A plain textarea, not a rich-text editor. Bodies render as structured text
 * rather than HTML because editor-supplied markup would be a stored-XSS sink
 * until PRD 12's sanitisation exists — so offering formatting controls that
 * produce HTML the site refuses to render would be a lie about what the field
 * does. `## ` starts a heading and `- ` a list item.
 */
const BODY_HINT = 'Blank line between paragraphs. "## " for a heading, "- " for a list item.'

export function PageForm({
  page,
}: {
  page?: {
    slug: string
    title: string
    body: string | null
    seoDescription: string | null
    published: boolean
  }
}) {
  const [state, action] = useAction(savePageAction)

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} successMessage="Saved." />

      <Field
        label="Slug"
        required
        hint="The URL path, e.g. about"
        error={fieldError(state, 'slug')}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="slug"
            required
            defaultValue={page?.slug ?? ''}
            readOnly={Boolean(page)}
            className={page ? 'bg-sand-50' : undefined}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Title" required error={fieldError(state, 'title')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="title"
            required
            defaultValue={page?.title ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Body" hint={BODY_HINT} error={fieldError(state, 'body')}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="body"
            rows={14}
            defaultValue={page?.body ?? ''}
            className="min-h-64 font-mono text-xs"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Search description" error={fieldError(state, 'seoDescription')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="seoDescription"
            maxLength={320}
            defaultValue={page?.seoDescription ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="publish"
          defaultChecked={page?.published ?? false}
          className="accent-brand-700 size-4"
        />
        Visible to the public
      </label>

      <SubmitButton pendingLabel="Saving…">Save page</SubmitButton>
    </form>
  )
}

export function PostForm({
  post,
}: {
  post?: {
    slug: string
    title: string
    body: string | null
    excerpt: string | null
    category: string | null
    seoDescription: string | null
    published: boolean
  }
}) {
  const [state, action] = useAction(savePostAction)

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} successMessage="Saved." />

      <Field label="Slug" required error={fieldError(state, 'slug')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="slug"
            required
            defaultValue={post?.slug ?? ''}
            readOnly={Boolean(post)}
            className={post ? 'bg-sand-50' : undefined}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Title" required error={fieldError(state, 'title')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="title"
            required
            defaultValue={post?.title ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Category" error={fieldError(state, 'category')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="category"
            defaultValue={post?.category ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Excerpt" hint="Shown on the blog index." error={fieldError(state, 'excerpt')}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="excerpt"
            rows={3}
            defaultValue={post?.excerpt ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Body" hint={BODY_HINT} error={fieldError(state, 'body')}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="body"
            rows={14}
            defaultValue={post?.body ?? ''}
            className="min-h-64 font-mono text-xs"
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <Field label="Search description" error={fieldError(state, 'seoDescription')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="seoDescription"
            maxLength={320}
            defaultValue={post?.seoDescription ?? ''}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="publish"
          defaultChecked={post?.published ?? false}
          className="accent-brand-700 size-4"
        />
        Published
      </label>

      <SubmitButton pendingLabel="Saving…">Save post</SubmitButton>
    </form>
  )
}
