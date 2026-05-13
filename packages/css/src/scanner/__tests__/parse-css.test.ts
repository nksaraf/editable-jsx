import { describe, expect, test } from "bun:test"
import { parseCSSVariables } from "../parse-css.js"

describe("parseCSSVariables", () => {
  test("extracts variables from :root", () => {
    const css = `:root {
      --accent: #0580aa;
      --bg: #ffffff;
      --container: 1200px;
    }`

    const vars = parseCSSVariables(css, "/test.css")
    expect(vars).toHaveLength(3)
    expect(vars[0].name).toBe("--accent")
    expect(vars[0].value).toBe("#0580aa")
    expect(vars[0].scope).toBe(":root")
    expect(vars[1].name).toBe("--bg")
    expect(vars[2].name).toBe("--container")
    expect(vars[2].value).toBe("1200px")
  })

  test("extracts variables from nested scopes", () => {
    const css = `
      :root { --fg: #212121; }
      .dark { --fg: #e2e8f0; }
    `
    const vars = parseCSSVariables(css, "/test.css")
    expect(vars).toHaveLength(2)
    expect(vars[0].scope).toBe(":root")
    expect(vars[1].scope).toBe(".dark")
    expect(vars[1].value).toBe("#e2e8f0")
  })

  test("extracts variables inside @media queries", () => {
    const css = `
      :root { --gutter: 1.5rem; }
      @media (max-width: 700px) {
        :root { --gutter: 1rem; }
      }
    `
    const vars = parseCSSVariables(css, "/test.css")
    expect(vars).toHaveLength(2)
    expect(vars[0].scope).toBe(":root")
    expect(vars[0].value).toBe("1.5rem")
    expect(vars[1].scope).toBe("@media (max-width: 700px) :root")
    expect(vars[1].value).toBe("1rem")
  })

  test("handles rgba values", () => {
    const css = `:root {
      --border: rgba(0, 0, 0, 0.08);
      --accent-glow: rgba(5, 128, 170, 0.24);
    }`
    const vars = parseCSSVariables(css, "/test.css")
    expect(vars).toHaveLength(2)
    expect(vars[0].value).toBe("rgba(0, 0, 0, 0.08)")
    expect(vars[1].value).toBe("rgba(5, 128, 170, 0.24)")
  })

  test("handles font-stack values", () => {
    const css = `:root {
      --font-display: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }`
    const vars = parseCSSVariables(css, "/test.css")
    expect(vars).toHaveLength(1)
    expect(vars[0].value).toContain("Geist")
    expect(vars[0].value).toContain("sans-serif")
  })

  test("records correct file path", () => {
    const css = ":root { --x: 1; }"
    const vars = parseCSSVariables(css, "/src/styles/global.css")
    expect(vars[0].file).toBe("/src/styles/global.css")
  })

  test("applies line offset for embedded CSS", () => {
    const css = ":root { --x: 1; }"
    const vars = parseCSSVariables(css, "/file.astro", 42)
    expect(vars[0].line).toBe(43) // 1 (PostCSS line) + 42 (offset)
  })

  test("returns empty array for invalid CSS", () => {
    const vars = parseCSSVariables("{{not css}}", "/bad.css")
    expect(vars).toHaveLength(0)
  })

  test("ignores non-custom-property declarations", () => {
    const css = `
      :root { --accent: blue; }
      body { color: var(--accent); font-size: 16px; }
    `
    const vars = parseCSSVariables(css, "/test.css")
    expect(vars).toHaveLength(1)
    expect(vars[0].name).toBe("--accent")
  })
})
