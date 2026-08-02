/**
 * Renders editor-supplied body text.
 *
 * Deliberately NOT `dangerouslySetInnerHTML`. Page bodies are written by
 * admins through the CMS, and an admin account is not a trusted rendering
 * context — a compromised or careless one would otherwise be a stored-XSS sink
 * on the site's most-linked pages. PRD 12 requires sanitisation before HTML is
 * accepted; until that exists, this splits on blank lines and renders text.
 *
 * Lines beginning `## ` become subheadings, and `- ` become list items, so an
 * editor has enough structure for a privacy policy without any markup being
 * interpreted.
 */
export function Prose({ body }: { body: string | null }) {
  if (!body?.trim()) return null

  const blocks = body.trim().split(/\n{2,}/)

  return (
    <div className="mt-8 space-y-4">
      {blocks.map((block, index) => {
        const lines = block.split('\n')

        if (block.startsWith('## ')) {
          return (
            <h2 key={index} className="font-display text-sand-900 pt-4 text-xl">
              {block.slice(3).trim()}
            </h2>
          )
        }

        if (lines.every((line) => line.trim().startsWith('- '))) {
          return (
            <ul key={index} className="text-sand-700 list-disc space-y-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{line.trim().slice(2)}</li>
              ))}
            </ul>
          )
        }

        return (
          <p key={index} className="text-sand-700 leading-relaxed">
            {block}
          </p>
        )
      })}
    </div>
  )
}
