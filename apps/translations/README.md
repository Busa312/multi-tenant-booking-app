# Translation editor

Every app's strings in one table — English, Georgian and Russian side by side —
saved straight back into the source files. Local only: never deployed.

```sh
pnpm translations        # http://localhost:4800  (PORT=… to change)
```

- **What's in it:** the CMS, the booking site, the booking site's legal pages and
  the marketing site (`src/sources.mjs`). Not the API's emails (their text is
  built in code) or the date names (CLDR data).
- **Filters:** search keys and text, pick an app, or show what needs attention —
  missing, still the same as English, placeholders that differ from the English
  (an unknown `{slot}` would be printed as is; a dropped one is fine if the
  sentence was rephrased), unsaved.
- **Saving** (button or ⌘S) writes only the changed text: a JSON catalog keeps its
  format, a TypeScript catalog has just that string literal replaced. If a file
  changed on disk since you loaded it, nothing is saved and you're told which.
- **Then:** review `git diff`, commit, and deploy — the apps pick the text up like
  any other change. Running dev servers reload on save.
- **Not here:** adding or removing keys (the apps' types require every language
  to have each key, so that's a code change), and values that are code — a
  function, a constant, an icon name — which are shown but changed in the file.
