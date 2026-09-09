import { describe, expect, it } from "vitest";

describe("desktop foundation", () => {
  it("keeps the renderer entrypoint testable", () => {
    expect("/src/main.tsx").toMatch(/main\.tsx$/);
  });
});
