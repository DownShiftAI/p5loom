// TypeScript declarations for p5loom. The spec types describe the JSON format (version 1). The schema in
// schema/p5loom-spec-1.schema.json is the same format for editors and validators.

export const SPEC_VERSION: 1;
export const ELEMENT_TYPES: readonly ["circle", "rect", "line", "scatter", "random-dots"];
export const CHART_TYPES: readonly ["axes", "bars", "points", "path", "text", "legend"];

export type Token = "bg" | "fg" | "accent" | "muted" | "grid";
export type ThemeName = "light" | "dark";
export interface Binding {
  control: string;
}
/** A number, or a binding to a slider. */
export type Num<T extends number = number> = T | Binding;
export type Point = [number, number];

export type Control =
  | { id: string; type: "slider"; label: string; min: number; max: number; step: number; value: number }
  | { id: string; type: "toggle"; label: string; value: boolean }
  | { id: string; type: "select"; label: string; options: string[]; value: string };

export type Row = Record<string, number | string>;

export type Element =
  | { type: "circle"; x: Num; y: Num; r: Num; fill?: Token | Binding; stroke?: Token | Binding; weight?: Num; when?: string }
  | { type: "rect"; x: Num; y: Num; w: Num; h: Num; fill?: Token | Binding; stroke?: Token | Binding; weight?: Num; when?: string }
  | { type: "line"; points: Point[]; stroke?: Token | Binding; weight?: Num; when?: string }
  | { type: "scatter"; data: Point[]; r?: number; fill?: Token | Binding; when?: string }
  | { type: "random-dots"; count: Num<number>; radius?: [number, number]; fill?: Token | Binding; when?: string }
  | {
      type: "axes" | "bars" | "points" | "path";
      table: string;
      x: string;
      y: string;
      xScale?: "band" | "linear" | "log";
      yScale?: "linear" | "log";
      zero?: boolean;
      frame?: [number, number, number, number];
      fill?: Token;
      stroke?: Token;
      r?: number;
      weight?: number;
      yTicks?: number;
      grid?: boolean;
      title?: boolean;
      when?: string;
    }
  | { type: "text"; text: string; x: number; y: number; size?: number; align?: "left" | "center" | "right"; fill?: Token; when?: string }
  | { type: "legend"; items: { label: string; fill: Token }[]; x: number; y: number; when?: string };

export interface Spec {
  version: 1;
  seed: Num<number>;
  theme?: ThemeName | Binding;
  canvas: { width: number; height: number };
  controls?: Control[];
  data?: Record<string, Row[]>;
  elements: Element[];
}

export type ControlValues = Record<string, number | boolean | string>;

export interface Plan {
  width: number;
  height: number;
  themeName: ThemeName;
  theme: Record<Token, string>;
  seed: number;
  elements: Element[];
  ops: Array<Record<string, unknown>>;
}

/** Returns a list of problems. An empty list means the spec is valid. Never throws for bad input. */
export function validateSpec(spec: unknown): string[];
/** Throws a TypeError with a `problems` array when the spec is invalid. */
export function assertValidSpec<T>(spec: T): T;
export function buildPlan(spec: Spec, values?: ControlValues): Plan;
export function describePlan(plan: Plan, spec?: Spec): string;
export function resolveSpec(spec: Spec, values?: ControlValues): Omit<Spec, "controls">;
export function controlDefaults(spec: Spec): ControlValues;
export function renderSvg(plan: Plan, description?: string): string;
export function sketchFrameDocument(options: { title?: string; scriptUrl?: string; theme?: ThemeName; p5Src?: string }): string;
export function assertSketch(code: string): string;
export const SKETCH_MAX_BYTES: number;

export interface P5Constructor {
  new (sketch: (p: unknown) => void, node?: HTMLElement): unknown;
}

export interface MountOptions {
  /** The p5.js constructor. Required. */
  p5: P5Constructor;
  /** Initial control values, by control id. */
  values?: ControlValues;
  /** Keep the control values in the address bar under ?p5loom-<shareKey>=. */
  shareKey?: string;
  /** Called after every change, with all values and the id that changed. */
  onChange?: (values: ControlValues, id: string) => void;
}

export interface MountHandle {
  plan(): Plan;
  description(): string;
  values(): ControlValues;
  /** Moves a control, redraws, announces the change, and updates the share link. */
  set(id: string, value: number | boolean | string): number | boolean | string;
  destroy(): void;
}

/** Draws the spec into element. Browser only. */
export function mount(element: HTMLElement, spec: Spec, options: MountOptions): MountHandle;
/** Puts a sandboxed sketch frame under element. src is /sketches/<name>/. Browser only. */
export function mountSketch(
  element: HTMLElement,
  options: { src: string; width: number; height: number; title?: string },
): { frame: HTMLIFrameElement; destroy(): void };
