import { describe, expect, test } from "bun:test"
import { extractStyleBlocks, parseAstroVariables } from "../parse-astro.js"

describe("extractStyleBlocks", () => {
  test("extracts a single <style> block", () => {
    const content = `<div>hello</div>\n<style>\n.foo { color: red; }\n</style>`
    const blocks = extractStyleBlocks(content)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].css).toContain(".foo")
    expect(blocks[0].isGlobal).toBe(false)
  })

  test("detects is:global attribute", () => {
    const content = `<style is:global>\n:root { --x: 1; }\n</style>`
    const blocks = extractStyleBlocks(content)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].isGlobal).toBe(true)
  })

  test("handles multiple <style> blocks", () => {
    const content = `
      <style is:global>:root { --a: 1; }</style>
      <div>content</div>
      <style>.local { color: red; }</style>
    `
    const blocks = extractStyleBlocks(content)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].isGlobal).toBe(true)
    expect(blocks[1].isGlobal).toBe(false)
  })

  test("handles <style lang='css'>", () => {
    const content = `<style lang="css">\n.foo { color: red; }\n</style>`
    const blocks = extractStyleBlocks(content)
    expect(blocks).toHaveLength(1)
  })

  test("records correct character offset", () => {
    const prefix = "<div>hello</div>\n"
    const content = `${prefix}<style>\n.foo {}\n</style>`
    const blocks = extractStyleBlocks(content)
    expect(blocks[0].charOffset).toBe(prefix.length)
  })

  test("returns empty for no style blocks", () => {
    const content = "<div>no styles here</div>"
    const blocks = extractStyleBlocks(content)
    expect(blocks).toHaveLength(0)
  })

  test("ignores <style> inside frontmatter strings", () => {
    const content = `---
const html = '<style>:root { --fake: yes; }</style>'
---
<div>content</div>
<style>
  .real { --real-var: blue; }
</style>`
    const blocks = extractStyleBlocks(content)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].css).toContain("--real-var")
    expect(blocks[0].css).not.toContain("--fake")
  })

  test("filters out <style> blocks inside HTML comments", () => {
    const content = `---
---
<!-- <style>:root { --commented: yes; }</style> -->
<style>
  .actual { color: red; }
</style>`
    const blocks = extractStyleBlocks(content)
    // Only the real block should be returned; the commented one should be filtered
    expect(blocks).toHaveLength(1)
    expect(blocks[0].css).toContain(".actual")
    expect(blocks[0].css).not.toContain("--commented")
  })

  test("filters out nested style in multi-line HTML comment", () => {
    const content = `<div>hello</div>
<!--
  <style is:global>
    :root { --old: red; }
  </style>
-->
<style>
  .real { color: blue; }
</style>`
    const blocks = extractStyleBlocks(content)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].css).toContain(".real")
  })
})

describe("parseAstroVariables", () => {
  test("extracts variables from Astro file with global styles", () => {
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

    const vars = parseAstroVariables(content, "/src/layouts/Base.astro")
    expect(vars).toHaveLength(2)
    expect(vars[0].name).toBe("--accent")
    expect(vars[0].value).toBe("#0580aa")
    expect(vars[0].isGlobal).toBe(true)
    expect(vars[0].file).toBe("/src/layouts/Base.astro")
  })

  test("extracts variables from scoped styles", () => {
    const content = `<div class="card">hello</div>
<style>
  .card { --card-bg: #f5f5f5; }
</style>`

    const vars = parseAstroVariables(content, "/src/components/Card.astro")
    expect(vars).toHaveLength(1)
    expect(vars[0].name).toBe("--card-bg")
    expect(vars[0].isGlobal).toBe(false)
    expect(vars[0].scope).toBe(".card")
  })

  test("handles lepton-web BaseLayout pattern", () => {
    const content = `---
import SEO from '../components/seo/SEO.astro';
---
<html lang="en-US">
<head></head>
<body><slot /></body>
</html>
<style is:global>
  :root {
    --font-display: 'Geist', sans-serif;
    --font-sans: 'Inter', sans-serif;
    --bg: #ffffff;
    --bg-elevated: #f5f7fa;
    --fg: #212121;
    --fg-muted: #4e4b66;
    --accent: #0580aa;
    --accent-hover: #046b8f;
    --footer-bg: #32373c;
    --footer-fg: #ffffff;
    --container: 1200px;
    --gutter: 1.5rem;
  }
</style>`

    const vars = parseAstroVariables(content, "/src/layouts/BaseLayout.astro")
    expect(vars).toHaveLength(12)
    expect(vars.map((v) => v.name)).toContain("--accent")
    expect(vars.map((v) => v.name)).toContain("--footer-bg")
    expect(vars.map((v) => v.name)).toContain("--container")
    expect(vars.every((v) => v.isGlobal)).toBe(true)
  })
})
