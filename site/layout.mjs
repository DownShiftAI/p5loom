// Page shell, in the Dawnshift design: a night header with the sun mark, the dawn wash fixed behind the page, a footer on
// a horizon. Scripts are external files only, so the site works under a strict Content-Security-Policy.

export const P5_URL = "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js";
export const SITE = "https://p5loom.dawnshift.co";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The mark: a half sun on a horizon. Colours come from CSS (.brand .sun, .brand .horizon), not attributes.
const MARK = `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path class="sun" d="M8 22a8 8 0 0 1 16 0z"/><line class="horizon" x1="3" y1="22" x2="29" y2="22"/></svg>`;

export function navHtml(sections, current) {
  return sections
    .map((s) => {
      const here = s.href === current ? ' aria-current="page"' : "";
      return `<a href="${s.href}"${here}>${esc(s.label)}</a>`;
    })
    .join("\n        ");
}

export function renderPage({ title, description, path, body, sections, docs = [], demos = false, modules = [], canonicalBase = SITE }) {
  const pageTitle = path === "/" ? "p5loom: describe the picture, p5loom draws it" : `${title} · p5loom`;
  const canonical = `${canonicalBase}${path}`;
  const extra = modules.map((m) => `  <script type="module" src="${esc(m)}"></script>\n`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(canonical)}">
  <meta name="theme-color" content="#F7F5F0" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
  <link rel="stylesheet" href="/assets/site.css">
  <link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
${demos ? `  <script src="${P5_URL}"></script>\n` : ""}  <script type="module" src="/assets/site.js"></script>
${extra}</head>
<body>
  <div class="dawn-wash" aria-hidden="true"></div>
  <a class="skip" href="#main">Skip to content</a>
  <header class="top">
    <div class="wrap bar-top">
      <a class="brand" href="/" aria-label="p5loom, home">${MARK}<span>p5loom</span></a>
      <nav aria-label="Main">
        ${navHtml(sections, path)}
      </nav>
      <button type="button" id="theme-toggle" class="line small" aria-label="Switch between light and dark">Light or dark</button>
    </div>
  </header>
${path === "/" || path.startsWith("/docs/") ? `  <nav class="subnav" aria-label="Documentation">
    <div class="wrap">${docs.map((d) => `<a href="${d.href}"${d.href === path ? ' aria-current="page"' : ""}>${esc(d.label)}</a>`).join("")}</div>
  </nav>` : ""}
  <main id="main" class="wrap">
${body}
  </main>
  <footer class="foot">
    <div class="horizon-line" aria-hidden="true"></div>
    <div class="wrap">
      <p>p5loom is open source under the MIT licence. Built on p5.js. Made by Dawnshift.</p>
      <p><a href="/docs/security.html">Security model</a> &middot; <a href="/docs/roadmap.html">Roadmap</a> &middot; <a href="/sitemap.xml">Sitemap</a></p>
    </div>
  </footer>
</body>
</html>
`;
}
