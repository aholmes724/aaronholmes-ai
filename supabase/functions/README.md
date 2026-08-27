# Supabase Edge Functions

## `generate-questions`

This function is the server-side boundary for model-backed curriculum question generation.

It intentionally keeps the OpenAI API key out of Astro/browser environment variables. The browser calls the Supabase function with the project's publishable key; the function reads `OPENAI_API_KEY` from Supabase secrets.

### Deploy

After linking the local repo to the Supabase project:

```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key
supabase functions deploy generate-questions
```

Do **not** add `OPENAI_API_KEY` to `.env`, any `PUBLIC_` variable, GitHub, or client-side code.

### v1 harness boundaries

The function currently:

- caps source text at 60,000 characters and generated sets at 30 questions;
- asks the model to classify source suitability before generating;
- blocks conversion of material into procedural training that meaningfully facilitates serious harm or wrongdoing while allowing appropriate historical/safety/defensive education;
- requires structured source evidence for every generated correct answer;
- constrains generated source/concept/objective IDs to IDs in the uploaded curriculum;
- rejects drafts with invalid answer counts, missing evidence, source mismatches, or weak explanations;
- stamps accepted drafts with provider, model, harness version, and prompt version for later quality comparison.

The browser runs an additional deterministic quality pass before merging drafts into a curriculum. This is deliberately a small generation harness, not an agent framework.

Before an adversarial public/teen beta, add backend abuse controls/rate limiting rather than relying on the publishable client key as an anti-abuse boundary.
