'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { runAction, ServiceError, type ActionResult } from '@/lib/action-result'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'
import { getActor } from '@/server/dal/actor'

/** CMS writes (PRD 6.11, 9.5). */

const pageSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Lower-case letters, numbers, and hyphens only.')
    .max(80),
  title: z.string().trim().min(1, 'A title is required.').max(160),
  body: z.string().trim().max(50_000).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  publish: z.boolean(),
})

async function assertCms() {
  const actor = await getActor()
  // Re-checked here as well as by RLS: a Server Action is a public endpoint,
  // and the screen that renders it is not what decides who may write.
  if (!can(actor, 'cms.publish')) {
    throw new ServiceError('forbidden', 'You do not have permission to edit content.')
  }
  return actor
}

export async function savePageAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ slug: string }>> {
  const result = await runAction('cms.savePage', async () => {
    const actor = await assertCms()

    const input = pageSchema.parse({
      slug: String(form.get('slug') ?? '').trim(),
      title: String(form.get('title') ?? '').trim(),
      body: String(form.get('body') ?? '').trim() || undefined,
      seoDescription: String(form.get('seoDescription') ?? '').trim() || undefined,
      publish: form.get('publish') === 'on',
    })

    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('pages')
      .select('id, published_at')
      .eq('slug', input.slug)
      .maybeSingle()

    const row = {
      slug: input.slug,
      title: input.title,
      body: input.body ?? null,
      seo_description: input.seoDescription ?? null,
      status: input.publish ? ('published' as const) : ('draft' as const),
      // Set on first publication and then left alone, so "last updated" on the
      // public page does not jump every time a typo is fixed.
      published_at: input.publish ? (existing?.published_at ?? new Date().toISOString()) : null,
      updated_by: actor.userId,
    }

    const { error } = existing
      ? await supabase.from('pages').update(row).eq('id', existing.id)
      : await supabase.from('pages').insert({ ...row, created_by: actor.userId })

    if (error) {
      throw new ServiceError(
        error.code === '23505' ? 'conflict' : 'internal_error',
        error.code === '23505' ? 'That slug is already used.' : 'We could not save that page.',
      )
    }

    return { slug: input.slug }
  })

  if (result.ok) {
    revalidatePath('/admin/content')
    revalidatePath(`/${result.data.slug}`)
  }
  return result
}

const postSchema = pageSchema.extend({
  excerpt: z.string().trim().max(400).optional(),
  category: z.string().trim().max(80).optional(),
})

export async function savePostAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ slug: string }>> {
  const result = await runAction('cms.savePost', async () => {
    const actor = await assertCms()

    const input = postSchema.parse({
      slug: String(form.get('slug') ?? '').trim(),
      title: String(form.get('title') ?? '').trim(),
      body: String(form.get('body') ?? '').trim() || undefined,
      excerpt: String(form.get('excerpt') ?? '').trim() || undefined,
      category: String(form.get('category') ?? '').trim() || undefined,
      seoDescription: String(form.get('seoDescription') ?? '').trim() || undefined,
      publish: form.get('publish') === 'on',
    })

    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('posts')
      .select('id, published_at')
      .eq('slug', input.slug)
      .maybeSingle()

    const row = {
      slug: input.slug,
      title: input.title,
      body: input.body ?? null,
      excerpt: input.excerpt ?? null,
      category: input.category ?? null,
      seo_description: input.seoDescription ?? null,
      status: input.publish ? ('published' as const) : ('draft' as const),
      published_at: input.publish ? (existing?.published_at ?? new Date().toISOString()) : null,
      author_id: actor.userId,
    }

    const { error } = existing
      ? await supabase.from('posts').update(row).eq('id', existing.id)
      : await supabase.from('posts').insert(row)

    if (error) {
      throw new ServiceError(
        error.code === '23505' ? 'conflict' : 'internal_error',
        error.code === '23505' ? 'That slug is already used.' : 'We could not save that post.',
      )
    }

    return { slug: input.slug }
  })

  if (result.ok) {
    revalidatePath('/admin/blog')
    revalidatePath('/blog')
    revalidatePath(`/blog/${result.data.slug}`)
  }
  return result
}
