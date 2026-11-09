// Replays a drawing plan on a p5 instance. Browser only: it needs a p5 constructor and a DOM element.
// Kept thin on purpose: all decisions are already made in plan.js.

export function replayPlan(p, plan) {
  p.resizeCanvas(plan.width, plan.height);
  p.noLoop();
  p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  for (const op of plan.ops) {
    if (op.op === "background") {
      p.background(op.colour);
      continue;
    }
    if (op.op === "text") {
      p.noStroke();
      p.fill(op.fill);
      p.textSize(op.size);
      const align = op.align === "center" ? p.CENTER : op.align === "right" ? p.RIGHT : p.LEFT;
      p.textAlign(align, p.BASELINE);
      p.text(op.text, op.x, op.y);
      continue;
    }
    if (op.fill) p.fill(op.fill); else p.noFill();
    if (op.stroke && op.weight > 0) {
      p.stroke(op.stroke);
      p.strokeWeight(op.weight);
    } else {
      p.noStroke();
    }
    switch (op.op) {
      case "circle":
        p.circle(op.x, op.y, op.d);
        break;
      case "rect":
        p.rect(op.x, op.y, op.w, op.h);
        break;
      case "line":
        p.noFill();
        p.stroke(op.stroke);
        p.strokeWeight(op.weight);
        p.beginShape();
        for (const [x, y] of op.points) p.vertex(x, y);
        p.endShape();
        break;
    }
  }
}
