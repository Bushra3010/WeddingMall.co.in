'use client'

import { useState } from 'react'

import { FormMessage, useAction } from '@/components/shared/action-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { updateShortlistNoteAction } from '@/features/enquiries/actions'

/** A private note against a saved vendor (PRD 6.5). Never shown to the vendor. */
export function ShortlistNote({ vendorId, note }: { vendorId: string; note: string | null }) {
  const [state, action] = useAction(updateShortlistNoteAction)
  const [editing, setEditing] = useState(false)

  if (!editing) {
    return (
      <div className="mt-2">
        {note ? <p className="text-sand-700 text-sm">{note}</p> : null}
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="px-0">
          {note ? 'Edit note' : 'Add a private note'}
        </Button>
      </div>
    )
  }

  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="vendorId" value={vendorId} />
      <FormMessage state={state} successMessage="Note saved." />
      <label htmlFor={`note-${vendorId}`} className="sr-only">
        Private note
      </label>
      <Input
        id={`note-${vendorId}`}
        name="note"
        defaultValue={note ?? ''}
        placeholder="e.g. Ask about parking"
        maxLength={500}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
