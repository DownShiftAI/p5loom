// A React component for p5loom. The library does not import React: pass it in.
//
//   import React from "react";
//   import { p5LoomComponent } from "p5loom/react";
//   const P5Loom = p5LoomComponent(React);
//   <P5Loom spec={spec} values={{ dots: 300 }} onChange={(values, id) => save(values)} />
//
// The picture is drawn after the component mounts (never during server rendering). A new spec remounts it; new
// control values are applied with set(), so the picture is not rebuilt for a slider drag.

import { mount } from "./index.js";

export function p5LoomComponent(React) {
  if (!React || typeof React.createElement !== "function") throw new TypeError("p5LoomComponent needs React: p5LoomComponent(React)");
  const { createElement: h, useRef, useEffect } = React;

  return function P5Loom({ spec, values, p5, shareKey, onChange, className, id }) {
    const host = useRef(null);
    const handle = useRef(null);
    // Latest onChange, so a new callback does not remount the picture.
    const changed = useRef(onChange);
    changed.current = onChange;

    useEffect(() => {
      if (!host.current || !spec) return undefined;
      const ctor = p5 ?? (typeof window !== "undefined" ? window.p5 : undefined);
      handle.current = mount(host.current, spec, {
        p5: ctor,
        values: values ?? {},
        shareKey,
        onChange: (v, changedId) => changed.current?.(v, changedId),
      });
      return () => {
        handle.current?.destroy();
        handle.current = null;
      };
      // Values are applied below, so the picture is only rebuilt when the spec or the share key changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spec, shareKey, p5]);

    useEffect(() => {
      const current = handle.current;
      if (!current || !values) return;
      const now = current.values();
      for (const [key, value] of Object.entries(values)) {
        if (now[key] !== value) current.set(key, value);
      }
    }, [values]);

    return h("div", { ref: host, className, id });
  };
}
