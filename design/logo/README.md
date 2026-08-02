# Logo source artwork

The two files supplied by the owner, kept so the derived assets can be
regenerated rather than reverse-engineered from a shipped PNG.

| Source | Derived | Where it is used |
| --- | --- | --- |
| `navbar-source.png` (512×256) | `public/logo-wordmark.png` (390×93) | Header and footer |
| `favicon-source.png` (512×512) | `src/app/icon.png`, `src/app/apple-icon.png` | Browser tab, iOS home screen |

## Why the navbar asset is not the source file

Both sources are RGB with **no alpha** — a flat cream background,
`rgb(253, 249, 241)`, identical on all four corners. On the homepage the
header is transparent over a near-black maroon hero, so the source would
render as a pale box sitting on the artwork.

`public/logo-wordmark.png` is the same image with that background keyed to
alpha and the surrounding space trimmed. The alpha is graded by distance from
the background colour rather than thresholded, so the curves of the monogram
keep their antialiasing instead of turning into stair-steps.

## Why the header inverts it rather than shipping a second file

The logo is maroon and gold. On the dark hero the maroon strokes all but
disappear, so the header applies `brightness-0 invert` in that state and the
whole mark renders flat white.

A hue-preserving lighten was tried first — scale each pixel toward its own
maximum channel — and it turned the maroon salmon-pink, which read as washed
out beside the gold. Flat white looked deliberate; the tinted version looked
like a rendering fault.

## Regenerating

`sharp` is already a dependency. The keying step is: trim on the background
colour, then set `alpha = 0` within 8 of it, `255` past 28, and linear in
between.
