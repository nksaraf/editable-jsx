import { describe, expect, test } from "bun:test"
import { applyAstroPatches } from "../astro-patcher.js"
import type { CSSPatch } from "../../types.js"

describe("applyAstroPatches", () => {
  test("updates a CSS variable in an Astro <style is:global> block", () => {
    const content = `---
const title = "Hello"
---
<div>{title}</div>
<style is:global>
  :root {
    --accent: #0580aa;
    --bg: #ffffff;
  }
</style>`

    const patches: CSSPatch[] = [
      {
        action_type: "updateCSSVariable",
        file: "/test.astro",
        variable: { name: "--accent", value: "#ff0000", scope: ":root" },
        styleBlockOffset: content.indexOf("<style"),
      },
    ]

    const result = applyAstroPatches(content, patches, "/test.astro")
    expect(result).toContain("--accent: #ff0000")
    expect(result).toContain("--bg: #ffffff")
    // Template portion should be unchanged
    expect(result).toContain('<div>{title}</div>')
  })

  test("preserves frontmatter and template", () => {
    const content = `---
import Layout from './Layout.astro'
const data = { x: 1 }
---
<Layout>
  <h1>Hello</h1>
</Layout>
<style is:global>
  :root { --color: blue; }
</style>`

    const patches: CSSPatch[] = [
      {
        action_type: "updateCSSVariable",
        file: "/test.astro",
        variable: { name: "--color", value: "red", scope: ":root" },
        styleBlockOffset: content.indexOf("<style"),
      },
    ]

    const result = applyAstroPatches(content, patches, "/test.astro")
    expect(result).toContain("import Layout from './Layout.astro'")
    expect(result).toContain("const data = { x: 1 }")
    expect(result).toContain("<h1>Hello</h1>")
    expect(result).toContain("--color: red")
  })

  test("handles multiple style blocks", () => {
    const content = `<div>content</div>
<style is:global>
  :root { --global-var: blue; }
</style>
<style>
  .local { --local-var: red; }
</style>`

    const globalOffset = content.indexOf("<style is:global>")
    const localOffset = content.indexOf("<style>", globalOffset + 1)

    const patches: CSSPatch[] = [
      {
        action_type: "updateCSSVariable",
        file: "/test.astro",
        variable: { name: "--global-var", value: "green", scope: ":root" },
        styleBlockOffset: globalOffset,
      },
      {
        action_type: "updateCSSVariable",
        file: "/test.astro",
        variable: { name: "--local-var", value: "pink", scope: ".local" },
        styleBlockOffset: localOffset,
      },
    ]

    const result = applyAstroPatches(content, patches, "/test.astro")
    expect(result).toContain("--global-var: green")
    expect(result).toContain("--local-var: pink")
  })

  test("applies text content patches", () => {
    const content = `---
---
<h1>Old Title</h1>
<p>Some description text</p>
<style>
  h1 { color: blue; }
</style>`

    const patches: CSSPatch[] = [
      {
        action_type: "updateTextContent",
        file: "/test.astro",
        textContent: {
          line: 3,
          col: 5,
          oldText: "Old Title",
          newText: "New Title",
        },
      },
    ]

    const result = applyAstroPatches(content, patches, "/test.astro")
    expect(result).toContain("<h1>New Title</h1>")
    expect(result).toContain("Some description text")
  })

  test("returns content unchanged if no style blocks found", () => {
    const content = "<div>no styles</div>"
    const result = applyAstroPatches(content, [], "/test.astro")
    expect(result).toBe(content)
  })
})
