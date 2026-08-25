# Bundled fonts

## NotoSansGeorgian-SemiBold.ttf

Noto Sans Georgian, SemiBold (600), from Google Fonts.
Licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/), which
permits bundling and redistribution.

**Why it is here.** `next/og` ships exactly one font —
`noto-sans-v27-latin-regular.ttf` — and its `language/` fallback directory
contains only a type declaration. Georgian text therefore renders as tofu (empty
boxes) in a generated `ImageResponse`. This platform ships a `ka` CMS locale and
serves Georgian salons, so a Latin-only share image would be broken for a large
share of tenants.

TrueType rather than woff2 on purpose: satori (which backs `ImageResponse`)
reads ttf/otf/woff and cannot decode woff2.

This face covers Latin as well as Georgian, so it is the only font the OG route
needs.
