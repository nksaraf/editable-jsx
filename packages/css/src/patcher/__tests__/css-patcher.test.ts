import { describe, expect, test } from "bun:test"
import { applyCSSVariablePatches, applyCSSPropertyPatches } from "../css-patcher.js"
import type { CSSVariablePatch, CSSPropertyPatch } from "../../types.js"

describe("applyCSSVariablePatches", () => {
  test("updates a variable in :root", () => {
    const css = `:root {\n  --accent: #0580aa;\n  --bg: #ffffff;\n}`
    const patches: CSSVariablePatch[] = [
      {
        action_type: "updateCSSVariable",
        file: "/test.css",
        variable: { name: "--accent", value: "#ff0000", scope: ":root" },
        styleBlockOffset: 0,
      },
    ]

    const result = applyCSSVariablePatches(css, patches, "/test.css")
    expect(result).toContain("--accent: #ff0000")
    expect(result).toContain("--bg: #ffffff") // Unchanged
  })

  test("updates multiple variables", () => {
    const css = `:root {\n  --a: 1;\n  --b: 2;\n  --c: 3;\n}`
    const patches: CSSVariablePatch[] = [
      {
        action_type: "updateCSSVariable",
        file: "/test.css",
        variable: { name: "--a", value: "10", scope: ":root" },
        styleBlockOffset: 0,
      },
      {
        action_type: "updateCSSVariable",
        file: "/test.css",
        variable: { name: "--c", value: "30", scope: ":root" },
        styleBlockOffset: 0,
      },
    ]

    const result = applyCSSVariablePatches(css, patches, "/test.css")
    expect(result).toContain("--a: 10")
    expect(result).toContain("--b: 2")
    expect(result).toContain("--c: 30")
  })

  test("updates variable in specific scope (not :root)", () => {
    const css = `:root { --fg: #000; }\n.dark { --fg: #fff; }`
    const patches: CSSVariablePatch[] = [
      {
        action_type: "updateCSSVariable",
        file: "/test.css",
        variable: { name: "--fg", value: "#e2e8f0", scope: ".dark" },
        styleBlockOffset: 0,
      },
    ]

    const result = applyCSSVariablePatches(css, patches, "/test.css")
    expect(result).toContain("--fg: #000") // :root unchanged
    expect(result).toContain("--fg: #e2e8f0") // .dark updated
  })

  test("preserves other declarations in the same rule", () => {
    const css = `:root {\n  --a: 1;\n  --b: 2;\n  --c: 3;\n}`
    const patches: CSSVariablePatch[] = [
      {
        action_type: "updateCSSVariable",
        file: "/test.css",
        variable: { name: "--b", value: "updated", scope: ":root" },
        styleBlockOffset: 0,
      },
    ]

    const result = applyCSSVariablePatches(css, patches, "/test.css")
    expect(result).toContain("--a: 1")
    expect(result).toContain("--b: updated")
    expect(result).toContain("--c: 3")
  })
})

describe("applyCSSPropertyPatches", () => {
  test("updates a property value", () => {
    const css = `.header { background: blue; color: white; }`
    const patches: CSSPropertyPatch[] = [
      {
        action_type: "updateCSSProperty",
        file: "/test.css",
        property: {
          selector: ".header",
          name: "background",
          value: "red",
          line: 1,
          col: 1,
        },
        styleBlockOffset: 0,
      },
    ]

    const result = applyCSSPropertyPatches(css, patches, "/test.css")
    expect(result).toContain("background: red")
    expect(result).toContain("color: white")
  })
})
