// A text alternative for every visualization, built from what is drawn. Screen readers get it as the image label, and it
// is printed as a visually hidden caption. Counts only: nothing here guesses at meaning.

export function describePlan(plan, spec) {
  const elements = plan.elements ?? spec?.elements ?? [];
  const counts = {};
  for (const el of elements) counts[el.type] = (counts[el.type] ?? 0) + 1;
  const parts = Object.entries(counts).map(([type, n]) => `${n} ${type} ${n === 1 ? "element" : "elements"}`);
  const shapes = parts.length ? parts.join(", ") : "no elements";
  const dots = elements.filter((e) => e.type === "random-dots").reduce((sum, e) => sum + e.count, 0);
  const extra = dots ? `, ${dots} generated dots` : "";
  return `Visualization ${plan.width} by ${plan.height} pixels, ${plan.themeName} theme: ${shapes}${extra}.`;
}
