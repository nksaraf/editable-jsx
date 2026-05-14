import { describe, expect, test } from "bun:test"
import { patchText } from "../astro-template-patcher.js"
import type { AstroTextPatch } from "../../types.js"

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
