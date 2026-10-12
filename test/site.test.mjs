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
  for (const missing of ['legalName', 'email', 'siteUrl']) {
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
    assert.match(html, /Acme Repairs LLC, 1 Test St, Santa Barbara, CA 93101/);
    assert.match(html, /help@example\.com/);
    assert.match(html, /Effective date: October 9, 2026/);
  }
  assert.match(privacy, /photon\.komoot\.io/);
  assert.match(privacy, /no analytics/i);
  assert.match(privacy, /off until you turn it on/i);
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

test('the street address is optional and never leaves a dangling comma', () => {
  const { out } = buildInto({ ...FULL, address: '' });
  for (const page of ['privacy.html', 'terms.html']) {
    const html = readFileSync(join(out, page), 'utf8');
    assert.match(html, /Acme Repairs LLC/);
    assert.doesNotMatch(html, /Acme Repairs LLC,\s*[.(]/, `${page} has a dangling comma`);
    assert.doesNotMatch(html, /\[BUSINESS ADDRESS/);
  }
});

test('a draft reminds the publisher that an address can be added', () => {
  const { out } = buildInto({ ...FULL, address: '' }, ['--draft']);
  assert.match(readFileSync(join(out, 'privacy.html'), 'utf8'), /\[BUSINESS ADDRESS, optional\]/);
});

test('the privacy policy describes what the app really does', () => {
  const { out } = buildInto(FULL);
  const html = readFileSync(join(out, 'privacy.html'), 'utf8');
  // opt-in, and honest about the third party
  assert.match(html, /off by default/i);
  assert.match(html, /asks you to confirm/i);
  assert.match(html, /IP address/);
  assert.match(html, /does not specifically describe the Photon service/);
  assert.match(html, /openstreetmap\.org\/copyright/);
  // WhatsApp and payments: no claim of delivery or confirmation
  assert.match(html, /never sends messages by itself/i);
  assert.match(html, /cannot tell whether you did/i);
  assert.match(html, /cannot see whether a customer paid/i);
  assert.match(html, /Customer names and other personal details are not added to the link/);
  // backups and deletion
  assert.match(html, /not encrypted/i);
  assert.match(html, /does <strong>not<\/strong> delete/);
  assert.match(html, /Deleting your data/);
  assert.doesNotMatch(html, /uninstalling[^.]*removes[^.]*backup/i);
  // the app sets android:allowBackup="false": no cloud backup may be described
  assert.match(html, /turns off Android(&#39;|&rsquo;|'|’)s automatic cloud backup/);
  assert.doesNotMatch(html, /back up the app(&#39;|&rsquo;|'|’)s data to your Google account/i);
  assert.doesNotMatch(html, /encrypted end to end with your screen lock/i);
});

test('the policy makes no claim it cannot support', () => {
  const { out } = buildInto(FULL);
  const html = readFileSync(join(out, 'privacy.html'), 'utf8');
  assert.doesNotMatch(html, /\b(GDPR|HIPAA|SOC ?2|ISO ?27001|certified|compliant with|fully secure|bank-level|military)\b/i);
  assert.doesNotMatch(html, /reviewed by (an? )?(attorney|lawyer)/i);
  assert.doesNotMatch(html, /meet(s)? the CCPA thresholds|do(es)? not meet the CCPA/i); // revenue is the owner's fact, not ours
});

test('the terms cover messages, fees and unconfirmed payments', () => {
  const { out } = buildInto(FULL);
  const html = readFileSync(join(out, 'terms.html'), 'utf8');
  assert.match(html, /never sends a message by itself/i);
  assert.match(html, /Do not use the app to send promotional or bulk marketing messages/);
  assert.match(html, /does not check whether it is allowed/);
  assert.match(html, /surcharges for paying by credit card/);
  assert.match(html, /does not confirm that a customer paid/);
  assert.match(html, /© OpenStreetMap contributors/);
});

test('support explains deletion and what it does not remove', () => {
  const { out } = buildInto(FULL);
  const html = readFileSync(join(out, 'support.html'), 'utf8');
  assert.match(html, /Clear all data/);
  assert.match(html, /does <strong>not<\/strong> delete backup files/);
  // Android cloud backup is off in the app, so there is no phone backup setting to point to
  assert.match(html, /does not use Android's automatic cloud backup/);
  assert.doesNotMatch(html, /Google services/);
});

test('the landing page does not promote a credit-card surcharge or imply messages are sent for you', () => {
  const { out } = buildInto(FULL);
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /card fee|surcharge/i);
  assert.match(html, /Delivery fee/);
  assert.match(html, /press send yourself/);
  assert.match(html, /stay off until you turn them on/);
  assert.match(html, /cannot see them/);
});

test("markdown saved with Windows line endings still produces the whole page", () => {
  const lf = "## One\n\nFirst paragraph.\n\n- a\n- b\n\n## Two\n\nSecond paragraph.";
  const crlf = lf.replace(/\n/g, "\r\n");
  assert.equal(markdownToHtml(crlf), markdownToHtml(lf));
  assert.equal((markdownToHtml(crlf).match(/<h2 /g) ?? []).length, 2);
  assert.doesNotMatch(markdownToHtml(crlf), /\r/);
});

test("every section of the legal pages is rendered, not just the first", () => {
  const { out } = buildInto(FULL);
  for (const page of ["privacy.html", "terms.html"]) {
    const html = readFileSync(join(out, page), "utf8");
    const headings = (html.match(/<h2 /g) ?? []).length;
    assert.ok(headings >= 9, `${page} has only ${headings} sections`);
  }
});

test("the real source files build into complete pages even if saved with CRLF", () => {
  const { out } = buildInto(FULL);
  const html = readFileSync(join(out, "terms.html"), "utf8");
  assert.match(html, /Messages you send/);
  assert.match(html, /Ending, changes, governing law and contact/);
});

// ── Spanish and Portuguese ──────────────────────────────────────────────────────────────────
const TRANSLATED = [
  { dir: 'es', htmlLang: 'es' },
  { dir: 'pt', htmlLang: 'pt-BR' },
];

test('Spanish and Portuguese have every page, with the right language and no placeholders', () => {
  const { out, failed } = buildInto(FULL);
  assert.equal(failed, false);
  for (const { dir, htmlLang } of TRANSLATED) {
    for (const page of PAGES) {
      const file = join(out, dir, page);
      assert.ok(existsSync(file), `${dir}/${page} missing`);
      const html = readFileSync(file, 'utf8');
      assert.match(html, new RegExp(`<html lang="${htmlLang}">`), `${dir}/${page} lang`);
      assert.doesNotMatch(html, /\{\{/, `${dir}/${page} has an unresolved placeholder`);
      assert.doesNotMatch(html, /\[(LEGAL NAME|SUPPORT EMAIL|BUSINESS ADDRESS)/);
      assert.match(html, /<meta name="robots" content="index, follow">/);
      assert.match(html, new RegExp(`rel="canonical" href="https://invoiceflow\.example/${dir}/`));
    }
  }
});

test('every page points at all of its language versions', () => {
  const { out } = buildInto(FULL);
  for (const lang of ['', 'es/', 'pt/']) {
    const html = readFileSync(join(out, lang, 'privacy.html'), 'utf8');
    assert.match(html, /hreflang="en" href="https:\/\/invoiceflow\.example\/privacy\.html"/);
    assert.match(html, /hreflang="es" href="https:\/\/invoiceflow\.example\/es\/privacy\.html"/);
    assert.match(html, /hreflang="pt-BR" href="https:\/\/invoiceflow\.example\/pt\/privacy\.html"/);
    assert.match(html, /hreflang="x-default"/);
  }
  const sitemap = readFileSync(join(out, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /https:\/\/invoiceflow\.example\/es\/privacy\.html/);
  assert.match(sitemap, /https:\/\/invoiceflow\.example\/pt\/terms\.html/);
  assert.doesNotMatch(sitemap, /404/);
});

test('every internal link in Spanish and Portuguese points at something that exists', () => {
  const { out } = buildInto(FULL);
  for (const { dir } of TRANSLATED) {
    for (const page of PAGES) {
      const html = readFileSync(join(out, dir, page), 'utf8');
      for (const [, ref] of html.matchAll(/(?:href|src)="(\/[^"#]*)(?:#[^"]*)?"/g)) {
        const target = ref.endsWith('/') ? `${ref.slice(1)}index.html` : ref.slice(1);
        assert.ok(existsSync(join(out, target)), `${dir}/${page} links to missing ${ref}`);
      }
    }
  }
});

test('the translations keep the structure of the English pages', () => {
  const { out } = buildInto(FULL);
  const count = (html, re) => (html.match(re) ?? []).length;
  for (const page of ['index.html', 'privacy.html', 'terms.html', 'support.html']) {
    const en = readFileSync(join(out, page), 'utf8');
    for (const { dir } of TRANSLATED) {
      const tr = readFileSync(join(out, dir, page), 'utf8');
      for (const re of [/<h2[ >]/g, /<details/g, /<article/g, /<li>/g, /<a [^>]*href=/g]) {
        // The language switcher and nav are the same in every page; compare the page bodies only.
        const body = (h) => h.slice(h.indexOf('<main'), h.indexOf('</main>'));
        assert.equal(count(body(tr), re), count(body(en), re), `${dir}/${page}: ${re} differs from English`);
      }
    }
  }
});

test('the translated policy keeps every disclosure of the English one', () => {
  const { out } = buildInto(FULL);
  const must = {
    es: [/photon\.komoot\.io/, /no está cifrado/, /desactivadas por defecto/i, /nunca envía mensajes por sí sola/i, /buy\.stripe\.com/, /no tiene analítica/i],
    pt: [/photon\.komoot\.io/, /não é criptografado/, /desativadas por padrão/i, /nunca envia mensagens por conta própria/i, /buy\.stripe\.com/, /não tem análise de uso/i],
  };
  for (const [dir, checks] of Object.entries(must)) {
    const html = readFileSync(join(out, dir, 'privacy.html'), 'utf8');
    for (const re of checks) assert.match(html, re, `${dir} privacy is missing ${re}`);
    assert.match(html, /Acme Repairs LLC, 1 Test St, Santa Barbara, CA 93101/);
    assert.match(html, /help@example\.com/);
  }
});

test('the effective date is written in the reader’s language', () => {
  const { out } = buildInto(FULL);
  assert.match(readFileSync(join(out, 'es', 'privacy.html'), 'utf8'), /9 de octubre de 2026/);
  assert.match(readFileSync(join(out, 'pt', 'terms.html'), 'utf8'), /9 de outubro de 2026/);
  assert.match(readFileSync(join(out, 'privacy.html'), 'utf8'), /October 9, 2026/);
});

test('the Play button and unknown pages are translated too', () => {
  const { out } = buildInto(FULL);
  assert.match(readFileSync(join(out, 'es', 'index.html'), 'utf8'), /Próximamente en Google Play/);
  assert.match(readFileSync(join(out, 'pt', 'index.html'), 'utf8'), /Em breve no Google Play/);
  assert.match(readFileSync(join(out, '_redirects'), 'utf8'), /\/es\/\*\s+\/es\/404\.html\s+404/);
});

// ── Legal publisher and commercial brand ────────────────────────────────────────────────────
test('the legal publisher is the legal name; the brand only appears as a product line in the footer', () => {
  const { out, failed } = buildInto({ ...FULL, legalName: 'Acme Repairs LLC', brandName: 'ACME APPS' });
  assert.equal(failed, false);
  for (const dir of ['', 'es/', 'pt/']) {
    for (const page of ['index.html', 'privacy.html', 'terms.html', 'support.html']) {
      const html = readFileSync(join(out, dir, page), 'utf8');
      assert.match(html, /&copy; \d{4} Acme Repairs LLC\./, `${dir}${page} copyright is not the legal name`);
      assert.match(html, /<p class="muted">[^<]*ACME APPS[^<]*<\/p>/, `${dir}${page} has no brand line`);
      // the brand never stands in for the publisher
      assert.doesNotMatch(html, /(published by|publicada por|publicado por|©[^<]{0,12})\s*ACME APPS/i);
    }
    for (const page of ['privacy.html', 'terms.html']) {
      const html = readFileSync(join(out, dir, page), 'utf8');
      assert.match(html, /Acme Repairs LLC,\s*1 Test St/, `${dir}${page} does not name the legal publisher`);
      // legal pages mention the brand only in the footer line
      assert.equal((html.match(/ACME APPS/g) ?? []).length, 1, `${dir}${page} uses the brand more than once`);
    }
  }
});

test('without a brand name no brand line is printed', () => {
  const { out } = buildInto(FULL);
  for (const dir of ['', 'es/', 'pt/']) {
    const html = readFileSync(join(out, dir, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /is a product of|es un producto de|é um produto de/);
  }
});

test('the brand line is translated', () => {
  const { out } = buildInto({ ...FULL, brandName: 'ACME APPS' });
  assert.match(readFileSync(join(out, 'index.html'), 'utf8'), /InvoiceFlow is a product of ACME APPS\./);
  assert.match(readFileSync(join(out, 'es', 'index.html'), 'utf8'), /InvoiceFlow es un producto de ACME APPS\./);
  assert.match(readFileSync(join(out, 'pt', 'index.html'), 'utf8'), /O InvoiceFlow é um produto de ACME APPS\./);
});
