import { describe, expect, test } from "bun:test"
import { annotateAstroTemplate } from "../annotate.js"

describe("annotateAstroTemplate", () => {
  test("injects source attrs on HTML elements", async () => {
    const source = `---
const title = "Hello"
---
<div>
  <h1>{title}</h1>
  <p>Some text</p>
</div>`

    const result = await annotateAstroTemplate(source, "/src/pages/index.astro")

    // Every element should have data-editable-file
    expect(result).toContain('data-editable-file="/src/pages/index.astro"')
    // Should have line numbers
    expect(result).toContain('data-editable-line=')
    // Should have element names
    expect(result).toContain('data-editable-element="div"')
    expect(result).toContain('data-editable-element="h1"')
    expect(result).toContain('data-editable-element="p"')
  })

  test("annotates Astro components with component name", async () => {
    const source = `---
import Header from '../components/Header.astro'
---
<Header />
<div>content</div>`

    const result = await annotateAstroTemplate(source, "/src/pages/index.astro")

    expect(result).toContain('data-editable-element="Header"')
    expect(result).toContain('data-editable-component="Header"')
    expect(result).toContain('data-editable-element="div"')
    // div should NOT have component attr
    const divMatch = result.match(/data-editable-element="div"[^>]*>/)
    expect(divMatch?.[0]).not.toContain("data-editable-component")
  })

  test("preserves existing attributes", async () => {
    const source = `<div class="hero" id="main">
  <p class="lead">Hello world</p>
</div>`

    const result = await annotateAstroTemplate(source, "/test.astro")

    expect(result).toContain('class="hero"')
    expect(result).toContain('id="main"')
    expect(result).toContain('class="lead"')
    expect(result).toContain('data-editable-file="/test.astro"')
  })

  test("preserves frontmatter", async () => {
    const source = `---
import Layout from '../layouts/Layout.astro'
const items = [1, 2, 3]
---
<Layout>
  <h1>Title</h1>
</Layout>`

    const result = await annotateAstroTemplate(source, "/test.astro")

    expect(result).toContain("import Layout from")
    expect(result).toContain("const items = [1, 2, 3]")
  })

  test("handles self-closing elements", async () => {
    const source = `<img src="/logo.png" alt="Logo" />
<br />
<hr />`

    const result = await annotateAstroTemplate(source, "/test.astro")

    expect(result).toContain('data-editable-element="img"')
    expect(result).toContain('data-editable-element="br"')
    expect(result).toContain('data-editable-element="hr"')
  })

  test("handles nested components", async () => {
    const source = `---
import Card from './Card.astro'
import Button from './Button.astro'
---
<Card>
  <h2>Title</h2>
  <Button>Click me</Button>
</Card>`

    const result = await annotateAstroTemplate(source, "/test.astro")

    expect(result).toContain('data-editable-component="Card"')
    expect(result).toContain('data-editable-component="Button"')
    expect(result).toContain('data-editable-element="h2"')
  })
})
