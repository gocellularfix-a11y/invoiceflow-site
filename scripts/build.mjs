// Builds the static site into dist/.
//
//   node scripts/build.mjs            strict: refuses to build while any required detail is empty
//   node scripts/build.mjs --draft    fills the gaps with visible [PLACEHOLDERS] and stamps every page "DRAFT"
//
// No dependencies. Templates use {{ name }} (HTML-escaped) and {{{ name }}} (raw HTML).

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = process.env.SITE_OUT ? process.env.SITE_OUT : join(ROOT, 'dist');
const CONFIG_PATH = process.env.SITE_CONFIG ? process.env.SITE_CONFIG : join(ROOT, 'site.config.json');

// The street address is optional: it is shown only if the publisher chooses to give one.
const REQUIRED = {
  legalName: '[LEGAL NAME OF YOUR BUSINESS]',
  email: '[SUPPORT EMAIL]',
  siteUrl: 'http://localhost:8080',
};

export const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** {{ key }} is escaped, {{{ key }}} is inserted as-is. An unknown key is a build error, never silent. */
export const render = (template, vars, where = 'template') =>
  template
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, key) => lookup(vars, key, where))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => escapeHtml(lookup(vars, key, where)));

const lookup = (vars, key, where) => {
  if (!(key in vars)) throw new Error(`Unknown placeholder {{ ${key} }} in ${where}`);
  return vars[key];
};

/** The tiny Markdown the legal pages use: ## headings, paragraphs, - lists, **bold**, [links](url). */
export const markdownToHtml = (md) => {
  const inline = (text) =>
    escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*|[\w./-]+\.html)\)/g, '<a href="$2">$1</a>');

  // Windows editors and git checkouts write \r\n. Without this, a file saved that way has no blank
  // lines to split on and the whole page collapses into a single heading.
  const blocks = md.replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split('\n');
      if (/^##\s/.test(lines[0])) {
        const text = lines[0].replace(/^##\s+/, '');
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return `<h2 id="${id}">${inline(text)}</h2>`;
      }
      if (lines.every((l) => /^-\s/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^-\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${inline(lines.join(' '))}</p>`;
    })
    .join('\n');
};

export const loadConfig = (draft) => {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const missing = Object.keys(REQUIRED).filter((k) => !String(config[k] ?? '').trim());
  if (missing.length > 0 && !draft) {
    throw new Error(
      `Cannot publish yet. Fill these in site.config.json: ${missing.join(', ')}.\n` +
        `(Use "npm run build:draft" to preview with placeholders.)`,
    );
  }
  const filled = { ...config };
  for (const [key, placeholder] of Object.entries(REQUIRED)) {
    if (!String(filled[key] ?? '').trim()) filled[key] = placeholder;
  }
  filled.siteUrl = filled.siteUrl.replace(/\/+$/, '');
  const address = String(config.address ?? '').trim();
  filled.address = address;
  filled.addressSuffix = address ? `, ${address}` : draft ? ', [BUSINESS ADDRESS, optional]' : '';
  return filled;
};

const page = (config, draft, layout, { file, title, description, body, nav }) => {
  const vars = {
    ...config,
    year: String(new Date().getFullYear()),
    title,
    description,
    canonical: `${config.siteUrl}/${file === 'index.html' ? '' : file}`,
    draftBanner: draft
      ? '<div class="draft-banner" role="status">DRAFT preview. Contact details are placeholders. Do not publish.</div>'
      : '',
    curSupport: nav === 'support' ? ' aria-current="page"' : '',
    curPrivacy: nav === 'privacy' ? ' aria-current="page"' : '',
    curTerms: nav === 'terms' ? ' aria-current="page"' : '',
    robots: draft ? 'noindex, nofollow' : 'index, follow',
    playBlock: config.playStoreUrl
      ? `<a class="btn btn--primary" href="${escapeHtml(config.playStoreUrl)}" rel="noopener">Get it on Google Play</a>`
      : '<span class="btn btn--soon" aria-disabled="true">Coming soon to Google Play</span>',
    content: '',
  };
  vars.content = render(body, vars, `page ${file}`);
  return render(layout, vars, 'layout');
};

export const build = ({ draft = false } = {}) => {
  const config = loadConfig(draft);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true });

  const layout = readFileSync(join(SRC, 'layout.html'), 'utf8');
  const legalWrap = readFileSync(join(SRC, 'pages', '_legal.html'), 'utf8');
  const files = [];

  const emit = (spec) => {
    const html = page(config, draft, layout, spec);
    writeFileSync(join(OUT, spec.file), html);
    files.push(spec.file);
  };

  const fragment = (name) => readFileSync(join(SRC, 'pages', name), 'utf8');

  emit({
    file: 'index.html',
    title: 'InvoiceFlow: private invoicing that works offline',
    description:
      'Create invoices and estimates, track payments and send them by WhatsApp or PDF. Your data stays on your device. No account needed.',
    body: fragment('index.html'),
    nav: 'home',
  });
  emit({
    file: 'support.html',
    title: 'Support · InvoiceFlow',
    description: 'Get help with InvoiceFlow: contact us, back up and restore your data, and common questions.',
    body: fragment('support.html'),
    nav: 'support',
  });
  for (const [file, name, title, description] of [
    ['privacy.html', 'privacy', 'Privacy Policy · InvoiceFlow', 'How InvoiceFlow handles your information. Your data stays on your device.'],
    ['terms.html', 'terms', 'Terms and Conditions · InvoiceFlow', 'The terms for using the InvoiceFlow app.'],
  ]) {
    const md = render(readFileSync(join(SRC, 'content', `${name}.md`), 'utf8'), { ...config }, `content/${name}.md`);
    const heading = readFileSync(join(SRC, 'content', `${name}.title`), 'utf8').trim();
    emit({
      file,
      title,
      description,
      nav: name,
      body: render(legalWrap, { heading, effective: config.effectiveDate }, '_legal').replace(
        '<!--BODY-->',
        markdownToHtml(md),
      ),
    });
  }
  emit({
    file: '404.html',
    title: 'Page not found · InvoiceFlow',
    description: 'This page does not exist.',
    body: fragment('404.html'),
    nav: '',
  });

  writeFileSync(join(OUT, 'robots.txt'), draft ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
  if (!draft) {
    const urls = files.filter((f) => f !== '404.html').map((f) => `  <url><loc>${config.siteUrl}/${f === 'index.html' ? '' : f}</loc></url>`);
    writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  }
  writeFileSync(join(OUT, '.nojekyll'), '');
  return { files, draft };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { files, draft } = build({ draft: process.argv.includes('--draft') });
    console.log(`${draft ? 'Draft' : 'Production'} build: ${files.length} pages → dist/`);
  } catch (err) {
    console.error(`\nBuild stopped: ${err.message}\n`);
    process.exit(1);
  }
}
