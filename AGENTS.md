## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Question data conventions

- Question domains live under `src/data/questions/` (one file per domain, combined via `index.ts`). Add new domains as new files, not by growing an existing one.
- `concepts` values are lowercase kebab-case (e.g. `bearer-tokens`, `rate-limits`).
- Concept IDs must stay stable once used, since Weak Concepts accuracy tracking and future learning-resource mappings key off the exact string.
- Reuse an existing concept ID for the same idea across domains instead of creating a near-duplicate (e.g. don't add `pagination-api` if `pagination` already covers it).
- Practice-mode selection rules live in `src/data/practice-modes.ts` (`MODE_FILTERS`) as the single source of truth; do not duplicate mode-filtering logic elsewhere.
