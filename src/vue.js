// A Vue 3 component for p5loom. The library does not import Vue: pass in the functions it needs.
//
//   import { h, defineComponent } from "vue";
//   import { p5LoomVueComponent } from "p5loom/vue";
//   const P5Loom = p5LoomVueComponent({ h, defineComponent });
//   <P5Loom :spec="spec" :values="{ dots: 300 }" @change="(values) => save(values)" />
//
// The picture is drawn when the component is mounted. A new spec remounts it; new values are applied with set().

import { mount } from "./index.js";

export function p5LoomVueComponent({ h, defineComponent }) {
  if (typeof h !== "function" || typeof defineComponent !== "function") {
    throw new TypeError("p5LoomVueComponent needs { h, defineComponent } from vue");
  }
  return defineComponent({
    name: "P5Loom",
    props: {
      spec: { type: Object, required: true },
      values: { type: Object, default: () => ({}) },
      p5: { type: Function, default: null },
      shareKey: { type: String, default: undefined },
    },
    emits: ["change"],
    mounted() {
      this.draw();
    },
    beforeUnmount() {
      this.teardown();
    },
    watch: {
      spec() {
        this.teardown();
        this.draw();
      },
      shareKey() {
        this.teardown();
        this.draw();
      },
      values: {
        deep: true,
        handler(next) {
          if (!this.handle || !next) return;
          const now = this.handle.values();
          for (const [key, value] of Object.entries(next)) {
            if (now[key] !== value) this.handle.set(key, value);
          }
        },
      },
    },
    methods: {
      draw() {
        const el = this.$refs.host;
        if (!el) return;
        const ctor = this.p5 ?? (typeof window !== "undefined" ? window.p5 : undefined);
        this.handle = mount(el, this.spec, {
          p5: ctor,
          values: this.values,
          shareKey: this.shareKey,
          onChange: (values) => this.$emit("change", values),
        });
      },
      teardown() {
        this.handle?.destroy();
        this.handle = null;
      },
    },
    render() {
      return h("div", { ref: "host" });
    },
  });
}
