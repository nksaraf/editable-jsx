/**
 * Integration tests — validates that the shared TextPatcher from
 * @editable-jsx/core handles every scenario that the CSS and Astro
 * patchers need, including the full pipeline through replaceAtPosition
 * and replaceNormalized with all option combinations.
 *
 * These mirror the exact scenarios tested in:
 * - packages/css/src/patcher/__tests__/astro-patcher.test.ts (text patches)
 * - packages/astro/src/patcher/__tests__/patcher.test.ts (patchText)
 */
import { describe, expect, test } from "bun:test"
import { replaceAtPosition, replaceNormalized } from "../text-patcher.js"

// ── CSS text patch flows through core TextPatcher ─────────────────

describe("CSS text patch pipeline (replaceAtPosition)", () => {
  test("position-based replacement in Astro template", () => {
    const content = `---
---
<h1>Old Title</h1>
<p>Some description text</p>
<style>
  h1 { color: blue; }
</style>`

    const result = replaceAtPosition(content, 3, 5, "Old Title", "New Title", {
      textNodeOnly: true,
      skipFrontmatter: true,
      skipStyleBlocks: true,
    })
    expect(result).toContain("<h1>New Title</h1>")
    expect(result).toContain("Some description text")
  })

  test("falls back to normalized search when position-based lookup misses", () => {
    const content = `---
---
<h1>Hello World</h1>
<p>Other text</p>
<style>
  h1 { color: blue; }
</style>`

    // Wrong line — position-based will fail, should fall back
    const result = replaceAtPosition(content, 99, 1, "Hello World", "Goodbye World", {
      textNodeOnly: true,
      skipFrontmatter: true,
      skipStyleBlocks: true,
    })
    expect(result).toContain("<h1>Goodbye World</h1>")
  })

  test("falls back to normalized search when text not at expected column", () => {
    const content = `---
---
<h1>Hello World</h1>
<style>
  h1 { color: blue; }
</style>`

    const result = replaceAtPosition(content, 3, 99, "Hello World", "Updated World", {
      textNodeOnly: true,
      skipFrontmatter: true,
      skipStyleBlocks: true,
    })
    expect(result).toContain("<h1>Updated World</h1>")
  })

  test("throws when text is not found in any text-node context", () => {
    const content = `---
---
<h1>Actual Title</h1>
<style>
  h1 { color: blue; }
</style>`

    expect(() =>
      replaceAtPosition(
        content,
        0,
        0,
        "Nonexistent text that is not in the file",
        "Replacement",
        { textNodeOnly: true, skipFrontmatter: true, skipStyleBlocks: true },
      ),
    ).toThrow("Text not found")
  })
})

// ── Astro text patch flows through core TextPatcher ───────────────

describe("Astro text patch pipeline (replaceAtPosition)", () => {
  test("replaces text content by position", () => {
    const source = `---
---
<h1>Original Title</h1>
<p>Some body text</p>`

    const result = replaceAtPosition(
      source,
      3,
      5,
      "Original Title",
      "New Title",
      { textNodeOnly: true, skipFrontmatter: true, skipStyleBlocks: true },
    )
    expect(result).toContain("<h1>New Title</h1>")
    expect(result).toContain("Some body text")
  })

  test("replaces text using whitespace-normalized search (fallback)", () => {
    const source = `---
---
<p>
  This text spans
  multiple lines with
  indentation.
</p>`

    const result = replaceAtPosition(
      source,
      0,
      0,
      "This text spans multiple lines with indentation.",
      "Replaced text.",
      { textNodeOnly: true, skipFrontmatter: true, skipStyleBlocks: true },
    )
    expect(result).toContain("Replaced text.")
    expect(result).not.toContain("This text spans")
  })

  test("skips text in attributes (finds text node only)", () => {
    const source = `---
---
<div title="Hello World">Hello World</div>`

    const result = replaceAtPosition(
      source,
      0,
      0,
      "Hello World",
      "Changed",
      { textNodeOnly: true, skipFrontmatter: true, skipStyleBlocks: true },
    )
    // Should change the text node, not the attribute
    expect(result).toContain('title="Hello World"')
    expect(result).toContain(">Changed</div>")
  })
})

// ── Position-based with fallback works identically for both ───────

describe("position-based with fallback (unified behavior)", () => {
  test("exact position match takes priority over normalized search", () => {
    const source = `<h1>Target</h1>
<p>Target</p>`

    // Line 1, col 5 — should only replace the first Target
    const result = replaceAtPosition(source, 1, 5, "Target", "Hit")
    expect(result).toBe(`<h1>Hit</h1>
<p>Target</p>`)
  })

  test("line 0 skips position-based and uses normalized", () => {
    const source = "<p>\n  Multi line\n  text here\n</p>"
    const result = replaceAtPosition(source, 0, 0, "Multi line text here", "Single line")
    expect(result).toContain("Single line")
    expect(result).not.toContain("Multi line")
  })

  test("wrong line falls back to normalized search", () => {
    const source = "<div>content here</div>"
    const result = replaceAtPosition(source, 999, 1, "content here", "replaced")
    expect(result).toContain("replaced")
  })

  test("correct line but wrong column falls back to normalized search", () => {
    const source = "<span>value</span>"
    const result = replaceAtPosition(source, 1, 999, "value", "new-value")
    expect(result).toContain("new-value")
  })
})

// ── Text-node context validation works for both ───────────────────

describe("text-node context validation", () => {
  test("textNodeOnly skips attribute matches", () => {
    const source = '<div class="target">target</div>'
    const result = replaceNormalized(source, "target", "replaced", {
      textNodeOnly: true,
    })
    expect(result).toContain('class="target"')
    expect(result).toContain(">replaced</div>")
  })

  test("textNodeOnly with multiple attribute occurrences", () => {
    const source = '<a href="Click me" title="Click me">Click me</a>'
    const result = replaceNormalized(source, "Click me", "Clicked", {
      textNodeOnly: true,
    })
    expect(result).toContain('href="Click me"')
    expect(result).toContain('title="Click me"')
    expect(result).toContain(">Clicked</a>")
  })

  test("without textNodeOnly, matches first occurrence anywhere", () => {
    const source = '<div class="target">target</div>'
    const result = replaceNormalized(source, "target", "replaced")
    // Without textNodeOnly, the first occurrence (in attribute) is matched
    expect(result).toContain('class="replaced"')
  })
})

// ── Frontmatter skipping works for both ───────────────────────────

describe("frontmatter skipping", () => {
  test("skips frontmatter content when skipFrontmatter is true", () => {
    const source = '---\nconst x = "target"\n---\n<p>target</p>'
    const result = replaceNormalized(source, "target", "replaced", {
      skipFrontmatter: true,
    })
    expect(result).toContain('const x = "target"')
    expect(result).toContain("<p>replaced</p>")
  })

  test("does not skip frontmatter when option is false", () => {
    const source = '---\nconst x = "target"\n---\n<p>target</p>'
    const result = replaceNormalized(source, "target", "replaced", {
      skipFrontmatter: false,
    })
    // Without skipping, the first occurrence (in frontmatter) is matched
    expect(result).toContain('const x = "replaced"')
  })

  test("handles file with no frontmatter", () => {
    const source = "<p>content</p>"
    const result = replaceNormalized(source, "content", "new", {
      skipFrontmatter: true,
    })
    expect(result).toContain("<p>new</p>")
  })

  test("handles complex frontmatter with imports", () => {
    const source = `---
import Layout from './Layout.astro'
const data = { x: 1 }
---
<Layout>
  <h1>Hello</h1>
</Layout>`

    const result = replaceAtPosition(source, 0, 0, "Hello", "Goodbye", {
      skipFrontmatter: true,
      textNodeOnly: true,
    })
    expect(result).toContain("import Layout from './Layout.astro'")
    expect(result).toContain("<h1>Goodbye</h1>")
  })
})

// ── Multi-line whitespace normalization works for both ────────────

describe("multi-line whitespace normalization", () => {
  test("matches text spanning multiple lines", () => {
    const source = "<p>\n  This text spans\n  multiple lines.\n</p>"
    const result = replaceNormalized(source, "This text spans multiple lines.", "Replaced.")
    expect(result).toContain("Replaced.")
    expect(result).not.toContain("This text spans")
  })

  test("matches text with varying indentation", () => {
    const source = "<div>\n\t\tHeavily\n\t\tindented\n\t\tcontent\n</div>"
    const result = replaceNormalized(source, "Heavily indented content", "Flat")
    expect(result).toContain("Flat")
    expect(result).not.toContain("Heavily")
  })

  test("matches text with mixed whitespace (tabs and spaces)", () => {
    const source = "<p>\n \t Mixed\t  whitespace\n  here  \n</p>"
    const result = replaceNormalized(source, "Mixed whitespace here", "Clean")
    expect(result).toContain("Clean")
  })

  test("matches single-line text that has internal extra spaces", () => {
    const source = "<span>  extra   spaces  </span>"
    const result = replaceNormalized(source, "extra spaces", "normal")
    expect(result).toContain("normal")
  })

  test("position-based with multi-line fallback", () => {
    const source = `---
---
<article>
  <p>
    Long paragraph that
    wraps across lines
    in the source.
  </p>
</article>`

    const result = replaceAtPosition(
      source,
      0,
      0,
      "Long paragraph that wraps across lines in the source.",
      "Short paragraph.",
      { textNodeOnly: true, skipFrontmatter: true },
    )
    expect(result).toContain("Short paragraph.")
    expect(result).not.toContain("Long paragraph")
  })
})

// ── Unicode and emoji work for both ───────────────────────────────

describe("unicode and emoji", () => {
  test("replaces text containing emoji", () => {
    const source = "<p>Hello 🌍 World</p>"
    const result = replaceNormalized(source, "Hello 🌍 World", "Hi 🚀")
    expect(result).toContain("Hi 🚀")
  })

  test("replaces text containing unicode characters", () => {
    const source = "<h1>Caf\u00e9 M\u00e9nu</h1>"
    const result = replaceNormalized(source, "Caf\u00e9 M\u00e9nu", "New Menu")
    expect(result).toContain("New Menu")
  })

  test("position-based with emoji", () => {
    const source = "<p>Hello 🌍</p>"
    const result = replaceAtPosition(source, 1, 4, "Hello 🌍", "Bye 🌙")
    expect(result).toBe("<p>Bye 🌙</p>")
  })

  test("multi-line with emoji and normalization", () => {
    const source = "<p>\n  Hello 🌍\n  World 🌎\n</p>"
    const result = replaceNormalized(source, "Hello 🌍 World 🌎", "Earth 🌏")
    expect(result).toContain("Earth 🌏")
  })
})

// ── Attribute-vs-text-node disambiguation works for both ──────────

describe("attribute vs text-node disambiguation", () => {
  test("text appears in both attribute and text node — textNodeOnly finds text node", () => {
    const source = '<div title="Hello World">Hello World</div>'
    const result = replaceNormalized(source, "Hello World", "Changed", {
      textNodeOnly: true,
    })
    expect(result).toContain('title="Hello World"')
    expect(result).toContain(">Changed</div>")
  })

  test("text appears only in attribute — textNodeOnly throws", () => {
    const source = '<img alt="Missing text" />'
    expect(() =>
      replaceNormalized(source, "Missing text", "New", { textNodeOnly: true }),
    ).toThrow("Text not found")
  })

  test("nested elements with text in both attributes and content", () => {
    const source = `<div class="greeting">
  <span data-label="Welcome">Welcome</span> to
  <a href="/home" title="Home">Home</a>
</div>`

    const result = replaceNormalized(source, "Welcome", "Hello", {
      textNodeOnly: true,
    })
    expect(result).toContain('data-label="Welcome"')
    expect(result).toContain(">Hello</span>")
  })

  test("self-closing tag attribute is not text node context", () => {
    const source = '<input placeholder="Enter name" />\n<p>Enter name</p>'
    const result = replaceNormalized(source, "Enter name", "Type here", {
      textNodeOnly: true,
    })
    expect(result).toContain('placeholder="Enter name"')
    expect(result).toContain("<p>Type here</p>")
  })
})

// ── Style block skipping works for both ───────────────────────────

describe("style block skipping", () => {
  test("skips text inside <style> blocks", () => {
    const source = "<p>hello</p>\n<style>.hello { color: red; }</style>"
    const result = replaceNormalized(source, "hello", "world", {
      skipStyleBlocks: true,
    })
    expect(result).toContain("<p>world</p>")
    expect(result).toContain(".hello") // style block preserved
  })

  test("combined frontmatter + style block skipping", () => {
    const source = `---
const hello = "world"
---
<h1>hello</h1>
<style>
  .hello { color: blue; }
</style>`

    const result = replaceNormalized(source, "hello", "goodbye", {
      skipFrontmatter: true,
      skipStyleBlocks: true,
      textNodeOnly: true,
    })
    expect(result).toContain('const hello = "world"')
    expect(result).toContain("<h1>goodbye</h1>")
    expect(result).toContain(".hello")
  })

  test("multiple style blocks — only searches before first", () => {
    const source = `<p>target</p>
<style>.a { content: "target"; }</style>
<style>.b { content: "target"; }</style>`

    const result = replaceNormalized(source, "target", "hit", {
      skipStyleBlocks: true,
    })
    expect(result).toContain("<p>hit</p>")
    expect(result).toContain('"target"')
  })
})

// ── Full CSS-like pipeline test ───────────────────────────────────

describe("full CSS patcher pipeline simulation", () => {
  test("sequential text patches applied one after another", () => {
    let source = `---
---
<h1>Title</h1>
<p>Description</p>
<style>
  h1 { color: blue; }
</style>`

    // Simulate CSS patcher applying multiple text patches in sequence
    source = replaceAtPosition(source, 3, 5, "Title", "New Title", {
      textNodeOnly: true,
      skipFrontmatter: true,
      skipStyleBlocks: true,
    })
    source = replaceAtPosition(source, 4, 4, "Description", "New Description", {
      textNodeOnly: true,
      skipFrontmatter: true,
      skipStyleBlocks: true,
    })

    expect(source).toContain("<h1>New Title</h1>")
    expect(source).toContain("<p>New Description</p>")
    expect(source).toContain("h1 { color: blue; }")
  })
})

// ── Full Astro-like pipeline test ─────────────────────────────────

describe("full Astro patcher pipeline simulation", () => {
  test("sequential text patches with position and fallback", () => {
    let source = `---
const x = 1
---
<h1>Header</h1>
<p>
  Body text that
  spans lines.
</p>`

    // Position-based (exact match)
    source = replaceAtPosition(source, 4, 5, "Header", "Updated Header", {
      textNodeOnly: true,
      skipFrontmatter: true,
      skipStyleBlocks: true,
    })

    // Fallback to normalized (line=0 means no position)
    source = replaceAtPosition(
      source,
      0,
      0,
      "Body text that spans lines.",
      "New body.",
      { textNodeOnly: true, skipFrontmatter: true, skipStyleBlocks: true },
    )

    expect(source).toContain("<h1>Updated Header</h1>")
    expect(source).toContain("New body.")
    expect(source).toContain("const x = 1")
  })
})
