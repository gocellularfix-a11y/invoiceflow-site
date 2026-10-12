// Builds the static site into dist/.
//
//   node scripts/build.mjs            strict: refuses to build while any required detail is empty
//   node scripts/build.mjs --draft    fills the gaps with visible [PLACEHOLDERS] and stamps every page "DRAFT"
//
// No dependencies. Templates use {{ name }} (HTML-escaped) and {{{ name }}} (raw HTML).

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LANG, LANGS, STRINGS, prefixOf } from './strings.mjs';

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

const PAGE_FILES = { index: 'index.html', support: 'support.html', privacy: 'privacy.html', terms: 'terms.html', notfound: '404.html' };

/** "October 9, 2026" written in the reader's language; the original text if it is not a date. */
export const localizedDate = (text, locale) => {
  const parsed = new Date(`${String(text).trim()} 00:00:00 UTC`);
  if (Number.isNaN(parsed.getTime())) return text;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
};

const page = (config, draft, layout, lang, { key, body, nav }) => {
  const s = STRINGS[lang];
  const prefix = prefixOf(lang);
  const file = PAGE_FILES[key];
  const path = file === 'index.html' ? '' : file;

  // Every language version of this page, for search engines and for the language switcher.
  const alternates = LANGS.map((l) => {
    const href = `${config.siteUrl}${prefixOf(l)}/${path}`;
    return `<link rel="alternate" hreflang="${STRINGS[l].hreflang}" href="${escapeHtml(href)}">`;
  });
  alternates.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(`${config.siteUrl}/${path}`)}">`);
  const switcher = LANGS.map((l) => {
    const current = l === lang ? ' aria-current="true"' : '';
    return `<li><a href="${prefixOf(l)}/${path}" hreflang="${STRINGS[l].hreflang}" lang="${STRINGS[l].hreflang}"${current}>${STRINGS[l].short}</a></li>`;
  });

  const vars = {
    ...config,
    year: String(new Date().getFullYear()),
    title: s.titles[key],
    description: s.descriptions[key],
    htmlLang: s.htmlLang,
    ogLocale: s.ogLocale,
    prefix,
    skip: s.skip,
    homeAria: s.homeAria,
    navAria: s.navAria,
    langAria: s.langAria,
    navFeatures: s.navFeatures,
    navPrivacy: s.navPrivacy,
    navTerms: s.navTerms,
    navSupport: s.navSupport,
    footPrivacy: s.footPrivacy,
    footTerms: s.footTerms,
    footSupport: s.footSupport,
    rights: s.rights,
    canonical: `${config.siteUrl}${prefix}/${path}`,
    alternates: alternates.join('\n  '),
    langSwitcher: switcher.join(''),
    draftBanner: draft
      ? '<div class="draft-banner" role="status">DRAFT preview. Contact details are placeholders. Do not publish.</div>'
      : '',
    curSupport: nav === 'support' ? ' aria-current="page"' : '',
    curPrivacy: nav === 'privacy' ? ' aria-current="page"' : '',
    curTerms: nav === 'terms' ? ' aria-current="page"' : '',
    robots: draft ? 'noindex, nofollow' : 'index, follow',
    playBlock: config.playStoreUrl
      ? `<a class="btn btn--primary" href="${escapeHtml(config.playStoreUrl)}" rel="noopener">${s.playLink}</a>`
      : `<span class="btn btn--soon" aria-disabled="true">${s.playSoon}</span>`,
    content: '',
  };
  vars.content = render(body, vars, `page ${lang}/${file}`);
  return render(layout, vars, 'layout');
};

export const build = ({ draft = false } = {}) => {
  const config = loadConfig(draft);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true });

  const layout = readFileSync(join(SRC, 'layout.html'), 'utf8');
  const files = []; // site-relative paths such as "index.html" or "es/privacy.html"

  for (const lang of LANGS) {
    const sub = lang === DEFAULT_LANG ? '' : lang;
    const pagesDir = join(SRC, 'pages', sub);
    const contentDir = join(SRC, 'content', sub);
    const outDir = join(OUT, sub);
    mkdirSync(outDir, { recursive: true });
    const legalWrap = readFileSync(join(pagesDir, '_legal.html'), 'utf8');
    const effective = localizedDate(config.effectiveDate, STRINGS[lang].locale);

    const emit = (spec) => {
      const html = page(config, draft, layout, lang, spec);
      const name = PAGE_FILES[spec.key];
      writeFileSync(join(outDir, name), html);
      files.push(sub ? `${sub}/${name}` : name);
    };
    const fragment = (name) => readFileSync(join(pagesDir, name), 'utf8');

    emit({ key: 'index', body: fragment('index.html'), nav: 'home' });
    emit({ key: 'support', body: fragment('support.html'), nav: 'support' });
    for (const name of ['privacy', 'terms']) {
      const md = render(readFileSync(join(contentDir, `${name}.md`), 'utf8'), { ...config }, `content/${sub}/${name}.md`);
      const heading = readFileSync(join(contentDir, `${name}.title`), 'utf8').trim();
      emit({
        key: name,
        nav: name,
        body: render(legalWrap, { heading, effective }, `_legal ${lang}`).replace('<!--BODY-->', markdownToHtml(md)),
      });
    }
    emit({ key: 'notfound', body: fragment('404.html'), nav: '' });
  }

  writeFileSync(join(OUT, 'robots.txt'), draft ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
  if (!draft) {
    const indexable = files.filter((f) => !f.endsWith('404.html'));
    const urlOf = (f) => `${config.siteUrl}/${f === 'index.html' ? '' : f.replace(/(^|\/)index\.html$/, '$1')}`;
    const entries = indexable.map((f) => {
      const lang = f.includes('/') ? f.split('/')[0] : DEFAULT_LANG;
      const base = f.includes('/') ? f.slice(lang.length + 1) : f;
      const alts = LANGS.map((l) => {
        const rel = l === DEFAULT_LANG ? base : `${l}/${base}`;
        return `    <xhtml:link rel="alternate" hreflang="${STRINGS[l].hreflang}" href="${urlOf(rel)}"/>`;
      });
      return `  <url>\n    <loc>${urlOf(f)}</loc>\n${alts.join('\n')}\n  </url>`;
    });
    writeFileSync(
      join(OUT, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`,
    );
  }
  writeFileSync(join(OUT, '.nojekyll'), '');
  // Netlify: an unknown address under /es/ or /pt/ shows that language's own "not found" page.
  writeFileSync(
    join(OUT, '_redirects'),
    LANGS.filter((l) => l !== DEFAULT_LANG).map((l) => `/${l}/*  /${l}/404.html  404`).join('\n') + '\n',
  );
  return { files, draft };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { files, draft } = build({ draft: process.argv.includes('--draft') });
    console.log(`${draft ? 'Draft' : 'Production'} build: ${files.length} pages in ${LANGS.length} languages → dist/`);
  } catch (err) {
    console.error(`\nBuild stopped: ${err.message}\n`);
    process.exit(1);
  }
}
