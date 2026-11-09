// A web component: <p5-loom src="/examples/bar-chart.json"> or <p5-loom spec='{...}'>. Works in any page, with any
// framework or none. Browser only. Call defineP5Loom() once.
//
//   attributes  spec       the spec as a JSON string
//               src        a URL the spec is fetched from (same origin, or with CORS)
//               share-key  a key for sharing control values in the URL (see mount)
//   properties  spec       set a spec object directly
//   methods     set(id, value), values(), description()
//   events      p5loom-change  bubbles; detail is { id, value, values }

import { mount } from "./index.js";

export function defineP5Loom({ p5 = globalThis.p5, tagName = "p5-loom" } = {}) {
  if (typeof customElements === "undefined") throw new Error("defineP5Loom needs a browser with custom elements");
  if (customElements.get(tagName)) return tagName;

  class P5LoomElement extends HTMLElement {
    static get observedAttributes() {
      return ["spec", "src", "share-key"];
    }

    constructor() {
      super();
      this._spec = null;
      this._handle = null;
      this._token = 0;
    }

    get spec() {
      return this._spec;
    }

    set spec(value) {
      this._spec = value;
      this.draw();
    }

    connectedCallback() {
      this.draw();
    }

    disconnectedCallback() {
      this.teardown();
    }

    attributeChangedCallback(name) {
      if (!this.isConnected) return;
      if (name === "spec") this._spec = null;
      this.draw();
    }

    set(id, value) {
      if (!this._handle) throw new Error("p5-loom is not drawn yet");
      return this._handle.set(id, value);
    }

    values() {
      return this._handle ? this._handle.values() : {};
    }

    description() {
      return this._handle ? this._handle.description() : "";
    }

    teardown() {
      this._handle?.destroy();
      this._handle = null;
    }

    async load() {
      if (this._spec) return this._spec;
      if (this.hasAttribute("spec")) return JSON.parse(this.getAttribute("spec"));
      if (this.hasAttribute("src")) {
        const res = await fetch(this.getAttribute("src"), { credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${this.getAttribute("src")}`);
        return res.json();
      }
      return null;
    }

    // Draws the picture. A newer call wins: a slow fetch can never replace a picture drawn after it.
    async draw() {
      const token = (this._token += 1);
      this.teardown();
      let spec;
      try {
        spec = await this.load();
      } catch (err) {
        if (token === this._token) this.textContent = `The picture could not be loaded: ${err.message}`;
        return;
      }
      if (token !== this._token) return;
      if (!spec) {
        this.textContent = "";
        return;
      }
      try {
        const share = this.getAttribute("share-key") ?? undefined;
        this._handle = mount(this, spec, {
          p5,
          shareKey: share,
          onChange: (values, id) => {
            this.dispatchEvent(new CustomEvent("p5loom-change", { detail: { id, value: values[id], values }, bubbles: true }));
          },
        });
      } catch (err) {
        this.textContent = `The picture could not be drawn: ${err.message}`;
      }
    }
  }

  customElements.define(tagName, P5LoomElement);
  return tagName;
}
