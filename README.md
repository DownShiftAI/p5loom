# p5loom

**Describe a picture as data. p5loom draws it.**

p5loom turns a small JSON spec into a [p5.js](https://p5js.org) visualisation. The spec is data, not code, so it can be stored, diffed, shared in a link, written by a model, and checked before anything draws. Every picture is reproducible from its seed, uses theme tokens so light and dark both work, and ships with a text description for screen readers.

- **Docs and playground:** https://p5loom.dawnshift.co
- **JSON Schema:** https://p5loom.dawnshift.co/schema/p5loom-spec-1.schema.json
- **License:** MIT

## Features

- **Spec format** with five drawing elements (circle, rect, line, scatter, seeded random dots) on normalised coordinates.
- **Controls:** sliders, toggles and selects that a picture follows, with `when` to hide elements. Values can live in the URL, and changes are announced to screen readers.
- **Charts from data:** named tables, band, linear and log scales, axes, bars, points, paths, text and legends. Scales and ticks are computed from the numbers.
- **Code mode:** run a p5.js sketch you wrote in a sandboxed frame, with no network and a strict content policy.
- **Wrappers:** a `<p5-loom>` web component, plus React and Vue components. The core has no dependencies.
- **SVG output** from the same plan as the browser picture, for documents and for AI clients.
- **MCP server:** lets any MCP client validate, describe and draw specs, read the reference, schema and examples, and use prompts for common tasks. It runs over stdio or HTTP, with optional bearer-token authentication and rate limits.
- **Accessible by default:** text alternatives, WCAG contrast in both themes, keyboard-operable controls, reduced-motion support.

## Install

p5loom is not on npm yet. Until it is, install from the repository:

```sh
git clone https://github.com/DownShiftAI/p5loom.git
cd p5loom && npm pack          # creates p5loom-<version>.tgz
npm install ./p5loom-0.1.0.tgz # in your project
```

Once published, it will be `npm install p5loom`.

## Quick start

Load p5.js, then mount a spec:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js"></script>
<div id="chart"></div>
<script type="module">
  import { mount } from "p5loom";

  const spec = {
    version: 1,
    seed: 1,
    canvas: { width: 640, height: 400 },
    data: {
      sales: [
        { month: "Jan", revenue: 120 },
        { month: "Feb", revenue: 180 },
        { month: "Mar", revenue: 150 },
      ],
    },
    controls: [
      { id: "tint", type: "select", label: "Colour", options: ["accent", "muted"], value: "accent" },
    ],
    elements: [
      { type: "axes", table: "sales", x: "month", y: "revenue" },
      { type: "bars", table: "sales", x: "month", y: "revenue", fill: { control: "tint" } },
    ],
  };

  const handle = mount(document.getElementById("chart"), spec, { p5, shareKey: "sales" });
  handle.set("tint", "muted"); // redraws, announces the change, updates the link
</script>
```

The same spec as data, for any tool that reads JSON:

```json
{
  "version": 1,
  "seed": 1,
  "canvas": { "width": 480, "height": 320 },
  "elements": [{ "type": "circle", "x": 0.5, "y": 0.5, "r": 0.3, "fill": "accent" }]
}
```

Coordinates run from 0 to 1, so the picture scales with its canvas. Colours are tokens (`bg`, `fg`, `accent`, `muted`, `grid`); the theme decides their values. A spec can't contain code: functions, scripts, and `javascript:`, `data:` or `vbscript:` strings are refused.

## Controls

```json
"controls": [
  { "id": "dots", "type": "slider", "label": "Stars", "min": 10, "max": 600, "step": 10, "value": 200 },
  { "id": "horizon", "type": "toggle", "label": "Horizon", "value": true }
],
"elements": [
  { "type": "random-dots", "count": { "control": "dots" }, "fill": "muted" },
  { "type": "line", "points": [[0, 0.8], [1, 0.8]], "stroke": "accent", "when": "horizon" }
]
```

A field follows a control with `{ "control": "<id>" }`. The control's range must fit the field: a coordinate can only follow a slider inside 0 to 1, and the validator says so when it doesn't.

## Charts

Charts read named data tables, and the scales come from the numbers:

| Element | Draws |
| --- | --- |
| `axes` | Axis lines, ticks, tick labels and field-name titles, optional grid |
| `bars` | One bar per row from a zero baseline |
| `points` | One dot per row |
| `path` | A polyline through the rows |
| `text` | A label |
| `legend` | Swatches and labels, up to 8 items |

Scales are `band` (categories, the default for bars), `linear` (numbers, zero baseline by default), and `log` (values spanning powers of ten).

## Use it from an AI client (MCP)

```sh
node bin/p5loom-mcp.mjs                          # stdio: Claude Desktop, Claude Code, Cursor, VS Code
node bin/p5loom-mcp.mjs --http 7340              # HTTP on 127.0.0.1, no token, loopback only
P5LOOM_MCP_TOKEN=<token> node bin/p5loom-mcp.mjs --http 7340 --host 0.0.0.0   # HTTP with a bearer token
node bin/p5loom-mcp.mjs --new-token              # print a new token
```

Claude Code:

```sh
claude mcp add p5loom -- node /path/to/p5loom/bin/p5loom-mcp.mjs
```

Claude Desktop, Cursor and VS Code take the same command in their MCP configuration.

- **Stdio** needs no token: the process runs as the user who started it.
- **HTTP without a token** is allowed only on a loopback address. Any other address without a token is refused at start-up.
- **HTTP with tokens** requires `Authorization: Bearer <token>` on every request. Set one token with `P5LOOM_MCP_TOKEN`, or several with `P5LOOM_MCP_TOKENS=name=token,...`. Tokens are stored as SHA-256 digests and compared in constant time.
- **Rate limits** apply to each HTTP caller (`--rate`, `--burst`).
- **Audit trail:** each tool call is one JSON line on stderr: caller, tool, outcome, duration. Arguments are never logged.

Tools: `p5loom_reference`, `p5loom_element_types`, `p5loom_validate`, `p5loom_list_controls`, `p5loom_resolve`, `p5loom_describe`, `p5loom_render_svg`, `p5loom_list_examples`, `p5loom_get_example`. Resources: the reference, the schema and each example. Prompts: `make-chart`, `design-controls`, `review-spec`.

## Code mode

A sketch is a file. It runs in an iframe with `sandbox="allow-scripts"` and no same-origin access, so it cannot read the host page, its cookies or its storage. Its frame policy allows scripts only from the pinned p5.js build and from its own file, and blocks all network access.

The sandbox protects the page that hosts a sketch. It does not stop a sketch from looping forever, which freezes only its own frame. Use code mode for sketches written by the page's author, not for code from visitors.

## Wrappers

```js
import { defineP5Loom } from "p5loom/element";   // <p5-loom src="/examples/bar-chart.json">
import { p5LoomComponent } from "p5loom/react";  // const P5Loom = p5LoomComponent(React)
import { p5LoomVueComponent } from "p5loom/vue"; // const P5Loom = p5LoomVueComponent({ h, defineComponent })
```

Each wrapper takes its framework as an argument, so the core library has no dependency on React or Vue.

## Accessibility

- Every picture has a role, a label and a visually hidden caption built from its counts. The text says what is drawn, not what it means.
- Body text meets WCAG AA (4.5:1) and graphics meet 3:1 in both themes. The tests check this.
- Controls are native, labelled inputs. Changes are announced once a slider settles.
- Pictures are drawn once; nothing animates.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/` | The library, including `src/mcp/` (the MCP server), `chart.js`, `controls.js`, `sketch.js`, and the wrappers |
| `bin/` | `p5loom-mcp.mjs`, the MCP command |
| `schema/` | The JSON Schema for version 1 specs |
| `types/` | TypeScript declarations |
| `styles/` | Optional default stylesheet for pictures and controls |
| `examples/` | Example specs, `catalog.json`, and `sketches/` |
| `site/` | The documentation site: pages, layout, design tokens, browser scripts, fonts |
| `scripts/` | Site build and checks, the static server, browser tests, visual regression, package check |
| `test/` | Unit tests, and visual baselines in `test/visual/baseline` |
| `deploy/` | Dockerfile, nginx configuration and Kubernetes manifest for the docs site |

## Development

Requires Node.js 20 or later. Browser tests need Google Chrome (set `CHROME_PATH` if it is not in the default location).

```sh
npm install
npm test                 # unit tests (164)
npm run docs             # build the site into dist/
npm run test:docs        # site build, links, policy and example checks
npm run serve            # serve dist/ on http://127.0.0.1:4173 with the production policy
npm run e2e:docs         # browser tests (125 checks)
npm run visual           # screenshot each example and compare with test/visual/baseline
npm run visual:update    # record new baselines (review them before committing)
npm run pack:check       # pack the tarball, install it in an empty project, and check the public API
```

Visual baselines are recorded on Windows. Font rendering differs between systems, so the visual check runs locally rather than in CI.

## Contributing

Issues and pull requests are welcome. Before opening a pull request, run `npm test`, `npm run test:docs` and `npm run e2e:docs`. Keep the library free of runtime dependencies, and keep the spec format backwards compatible within version 1: additions are fine, changed meanings are not.

## Security

Please report vulnerabilities privately through GitHub's security advisory form (the **Security** tab of this repository), not in a public issue. The most relevant areas are the spec validator, the MCP server's authentication and rate limits, and code mode's sandbox.

## Licence

MIT. Copyright (c) 2026 Dawnshift. See [LICENSE](LICENSE).

p5.js is LGPL-2.1 and is loaded separately from its own CDN; p5loom does not include it.
