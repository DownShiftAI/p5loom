// The integrations page: defines the <p5-loom> element for the page. Loaded only on that page.
import { defineP5Loom } from "/lib/element.js";

defineP5Loom({ p5: window.p5 });
