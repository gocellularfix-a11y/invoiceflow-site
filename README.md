# InvoiceFlow site

Landing page, Privacy Policy, Terms and Conditions and Support page for the InvoiceFlow app.
Plain HTML and CSS, built by a small Node script. No dependencies.

## Before publishing

Fill these in `site.config.json`. The production build refuses to run while any is empty:

| Field | Example |
|---|---|
| `legalName` | Your registered business name |
| `address` | Your business address (shown in the legal pages) |
| `email` | A support address you read |
| `siteUrl` | The public address of the site, e.g. `https://invoiceflow.example` |
| `playStoreUrl` | Leave empty until the app is live on Google Play. Then the button becomes a link. |

## Commands

```
npm run preview     build a DRAFT with visible placeholders and serve it at http://localhost:8080
npm run build       production build into dist/ (fails if details are missing)
npm test            builds into a temp folder and checks links, metadata, placeholders and claims
```

## Editing the text

- Privacy Policy: `src/content/privacy.md`
- Terms: `src/content/terms.md`
- Landing page: `src/pages/index.html`
- Support page: `src/pages/support.html`
- Your details are inserted from `site.config.json` wherever the text says `{{legalName}}`, `{{address}}` or `{{email}}`.

When you change the policy, update the effective date in `site.config.json`.
The policy text must always match what the app really does.

## Publishing

The publish workflow is saved in `deploy/pages.yml`. GitHub only accepts workflow files pushed by a login that has the
`workflow` permission, so to turn it on:

1. `gh auth refresh -h github.com -s workflow`
2. Move it: `git mv deploy/pages.yml .github/workflows/pages.yml` (create the folder first), then commit and push.
3. In the repository settings, set Pages to deploy from GitHub Actions.

Once the contact details are filled in, change its trigger to run on every push to `main`.
The repository must be **public** (or on a paid GitHub plan) for Pages to work. This repo holds
no app code, only the pages above, so it is safe to make public.

Google Play needs the Privacy Policy as a public link: `<siteUrl>/privacy.html`.
