import { describe, expect, it } from "vitest";
import { slugify } from "../src/modules/projects/slug";

describe("slugify", () => {
  it.each([
    ["O‘zbekiston", "ozbekiston"],
    ["Tog'lar va g`orlar", "toglar-va-gorlar"],
    ["Тест лойиҳа", "test-loyiha"],
    ["!!!", "project"],
    ["", "project"],
    ["  Salom   Dunyo  ", "salom-dunyo"],
  ])("%s -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("caps length and never ends with a dash", () => {
    const slug = slugify(`${"a".repeat(47)} bbbbbb`);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });
});
