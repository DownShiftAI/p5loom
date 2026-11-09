# Changelog

## 0.1.0

First release.

- Spec format version 1: circle, rect, line, scatter and seeded random-dots elements, on normalised coordinates with theme tokens.
- Controls: sliders, toggles and selects, bound to fields with `{ "control": id }`; `when` hides an element.
- Charts: named data tables, band, linear and log scales, axes, bars, points, paths, text and legends.
- Shareable control state in the URL (`shareKey`), and live announcements for screen readers.
- Code mode: p5.js sketches in a sandboxed frame, with a strict per-frame policy.
- Wrappers: a `<p5-loom>` web component, and React and Vue components.
- SVG output from the same plan as the browser picture.
- MCP server (stdio and HTTP), with bearer-token authentication, rate limits, an audit log, resources and prompts.
- JSON Schema for version 1 specs (`p5loom/schema.json`) and TypeScript declarations.
