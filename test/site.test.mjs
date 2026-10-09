import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownToHtml, render, escapeHtml } from '../scripts/build.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const BUILD = join(ROOT, 'scripts', 'build.mjs');

const FULL = {
  siteName: 'InvoiceFlow',
  legalName: 'Acme Repairs LLC',
  address: '1 Test St, Santa Barbara, CA 93101',
  email: 'help@example.com',
  siteUrl: 'https://invoiceflow.example',
  playStoreUrl: '',
  effectiveDate: 'October 9, 2026',
};

/** Runs the real build script against a throwaway config and output folder. */
const buildInto = (config, args = []) => {
  const dir = mkdtempSync(join(tmpdir(), 'ifsite-'));
  const cfg = join(dir, 'config.json');
  const out = join(dir, 'out');
  writeFileSync(cfg, JSON.stringify(config));
  const env = { ...process.env, SITE_CONFIG: cfg, SITE_OUT: out };
  try {
    execFileSync(process.execPath, [BUILD, ...args], { env, stdio: 'pipe' });
    return { out, failed: false };
  } catch (e) {
    return { out, failed: true, stderr: String(e.stderr) };
  }
};

const PAGES = ['index.html', 'privacy.html', 'terms.html', 'support.html', '404.html'];

test('refuses to publish while any required detail is empty', () => {
  for (const missing of ['legalName', 'address', 'email', 'siteUrl']) {
    const result = buildInto({ ...FULL, [missing]: '' });
    assert.equal(result.failed, true, `built without ${missing}`);
    assert.match(result.stderr, new RegExp(missing));
  }
});

test('a draft build works with placeholders and is hidden from search engines', () => {
  const { out, failed } = buildInto({ ...FULL, legalName: '', email: '' }, ['--draft']);
  assert.equal(failed, false);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /DRAFT preview/);
  assert.match(html, /noindex/);
  assert.match(html, /\[SUPPORT EMAIL\]/);
  assert.equal(existsSync(join(out, 'sitemap.xml')), false);
  assert.match(readFileSync(join(out, 'robots.txt'), 'utf8'), /Disallow: \//);
});

test('a production build is complete, clean and indexable', () => {
  const { out, failed } = buildInto(FULL);
  assert.equal(failed, false);

  for (const page of PAGES) {
    assert.ok(existsSync(join(out, page)), `${page} missing`);
    const html = readFileSync(join(out, page), 'utf8');
    assert.doesNotMatch(html, /\{\{/, `${page} has an unresolved placeholder`);
    assert.doesNotMatch(html, /\[(LEGAL NAME|SUPPORT EMAIL|BUSINESS ADDRESS)/, `${page} still has a bracketed placeholder`);
    assert.doesNotMatch(html, /DRAFT preview/);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]+">/);
    assert.match(html, /<meta name="robots" content="index, follow">/);
    for (const img of html.match(/<img\b[^>]*>/g) ?? []) assert.match(img, /\balt=/, `image without alt on ${page}`);
  }

  const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /https:\/\/invoiceflow\.example\/privacy\.html/);
  assert.doesNotMatch(sitemap, /404/);
  assert.match(readFileSync(join(out, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/invoiceflow\.example\/sitemap\.xml/);
});

test('every internal link and asset points at something that exists', () => {
  const { out } = buildInto(FULL);
  for (const page of PAGES) {
    const html = readFileSync(join(out, page), 'utf8');
    for (const [, ref] of html.matchAll(/(?:href|src)="(\/[^"#]*)(?:#[^"]*)?"/g)) {
      const target = ref === '/' ? 'index.html' : ref.slice(1);
      assert.ok(existsSync(join(out, target)), `${page} links to missing ${ref}`);
    }
  }
});

test('the legal pages carry the business details and the key disclosures', () => {
  const { out } = buildInto(FULL);
  const privacy = readFileSync(join(out, 'privacy.html'), 'utf8');
  const terms = readFileSync(join(out, 'terms.html'), 'utf8');
  for (const html of [privacy, terms]) {
    assert.match(html, /Acme Repairs LLC/);
    assert.match(html, /help@example\.com/);
    assert.match(html, /Effective date: October 9, 2026/);
  }
  assert.match(privacy, /photon\.komoot\.io/);
  assert.match(privacy, /no analytics/i);
  assert.match(terms, /backing it up/);
  assert.match(terms, /does not give tax, legal or accounting advice/);
});

test('the landing page makes no claim the app cannot back up', () => {
  const { out } = buildInto(FULL);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /Coming soon to Google Play/);
  assert.doesNotMatch(html, /app store|download now|free forever|bank-level|secure cloud/i);
});

test('with a Play Store link the button becomes a real link', () => {
  const { out } = buildInto({ ...FULL, playStoreUrl: 'https://play.google.com/store/apps/details?id=com.gocellular.invoiceflow' });
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /href="https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.gocellular\.invoiceflow"/);
  assert.doesNotMatch(html, /Coming soon to Google Play/);
});

test('markdown conversion escapes HTML so content cannot inject markup', () => {
  const html = markdownToHtml('## <script>alert(1)</script>\n\nHello <b>x</b> & **bold**\n\n- one\n- two');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.equal(escapeHtml('"a" & <b>'), '&quot;a&quot; &amp; &lt;b&gt;');
});

test('templates fail loudly on an unknown placeholder instead of printing nothing', () => {
  assert.throws(() => render('Hi {{ nope }}', {}), /Unknown placeholder/);
  assert.equal(render('Hi {{ a }} {{{ b }}}', { a: '<x>', b: '<y>' }), 'Hi &lt;x&gt; <y>');
});
