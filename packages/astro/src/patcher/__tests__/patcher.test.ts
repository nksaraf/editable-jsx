import { describe, expect, test } from "bun:test"
import { patchAttributes, patchText } from "../astro-template-patcher.js"
import type { AstroAttributePatch, AstroTextPatch } from "../../types.js"

describe("patchText", () => {
  test("replaces text content by position", async () => {
    const source = `---
---
<h1>Original Title</h1>
<p>Some body text</p>`

    const patches: AstroTextPatch[] = [
      {
        action_type: "updateAstroText",
        file: "/test.astro",
        source: { lineNumber: 3, columnNumber: 5 },
        oldText: "Original Title",
        newText: "New Title",
      },
    ]

    const result = await patchText(source, patches, "/test.astro")
    expect(result).toContain("<h1>New Title</h1>")
    expect(result).toContain("Some body text")
  })

  test("replaces text using whitespace-normalized search (fallback)", async () => {
    const source = `---
---
<p>
  This text spans
  multiple lines with
  indentation.
</p>`

    const patches: AstroTextPatch[] = [
      {
        action_type: "updateAstroText",
        file: "/test.astro",
        source: { lineNumber: 0, columnNumber: 0 },
        oldText: "This text spans multiple lines with indentation.",
        newText: "Replaced text.",
      },
    ]

    const result = await patchText(source, patches, "/test.astro")
    expect(result).toContain("Replaced text.")
    expect(result).not.toContain("This text spans")
  })

  test("skips text in attributes (finds text node only)", async () => {
    const source = `---
---
<div title="Hello World">Hello World</div>`

    const patches: AstroTextPatch[] = [
      {
        action_type: "updateAstroText",
        file: "/test.astro",
        source: { lineNumber: 0, columnNumber: 0 },
        oldText: "Hello World",
        newText: "Changed",
      },
    ]

    const result = await patchText(source, patches, "/test.astro")
    // Should change the text node, not the attribute
    expect(result).toContain('title="Hello World"')
    expect(result).toContain(">Changed</div>")
  })
})

describe("patchAttributes", () => {
  test("patches a quoted attribute value", async () => {
    const source = `<div class="hero" id="main">Hello</div>`

    const patches: AstroAttributePatch[] = [
      {
        action_type: "updateAstroAttribute",
        file: "/test.astro",
        source: { lineNumber: 1, columnNumber: 1 },
        attribute: "class",
        value: "updated-hero",
      },
    ]

    const result = await patchAttributes(source, patches, "/test.astro")
    expect(result).toContain('class="updated-hero"')
    expect(result).toContain('id="main"')
  })

  test("patches an expression attribute value", async () => {
    const source = `---
const active = true
---
<div class={active ? "on" : "off"}>Content</div>`

    const patches: AstroAttributePatch[] = [
      {
        action_type: "updateAstroAttribute",
        file: "/test.astro",
        source: { lineNumber: 4, columnNumber: 1 },
        attribute: "class",
        value: "always-on",
      },
    ]

    const result = await patchAttributes(source, patches, "/test.astro")
    // Expression should be replaced with a quoted value
    expect(result).toContain('class="always-on"')
    expect(result).not.toContain("active ?")
  })

  test("patches expression with nested braces", async () => {
    const source = `<div class={cn("base", { active: isActive })}>Content</div>`

    const patches: AstroAttributePatch[] = [
      {
        action_type: "updateAstroAttribute",
        file: "/test.astro",
        source: { lineNumber: 1, columnNumber: 1 },
        attribute: "class",
        value: "simple-class",
      },
    ]

    const result = await patchAttributes(source, patches, "/test.astro")
    expect(result).toContain('class="simple-class"')
    expect(result).not.toContain("cn(")
  })

  test("adds attribute when it doesn't exist", async () => {
    const source = `<div class="hero">Content</div>`

    const patches: AstroAttributePatch[] = [
      {
        action_type: "updateAstroAttribute",
        file: "/test.astro",
        source: { lineNumber: 1, columnNumber: 1 },
        attribute: "id",
        value: "main-hero",
      },
    ]

    const result = await patchAttributes(source, patches, "/test.astro")
    expect(result).toContain('id="main-hero"')
    expect(result).toContain('class="hero"')
  })

  test("patches multiple attributes on the same element", async () => {
    const source = `<div class="old" id="old-id">Content</div>`

    const patches: AstroAttributePatch[] = [
      {
        action_type: "updateAstroAttribute",
        file: "/test.astro",
        source: { lineNumber: 1, columnNumber: 1 },
        attribute: "class",
        value: "new",
      },
      {
        action_type: "updateAstroAttribute",
        file: "/test.astro",
        source: { lineNumber: 1, columnNumber: 1 },
        attribute: "id",
        value: "new-id",
      },
    ]

    const result = await patchAttributes(source, patches, "/test.astro")
    expect(result).toContain('class="new"')
    expect(result).toContain('id="new-id"')
  })
})
