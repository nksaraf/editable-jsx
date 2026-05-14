/**
 * Stress tests — real-world complexity that would trip up a naive editor.
 *
 * These test the patcher against patterns developers actually write:
 * expression attributes, loops, conditionals, nested components,
 * whitespace-sensitive content, special characters, and edge cases.
 */
import { describe, expect, test } from "bun:test"
import { patchAttributes, patchText } from "../astro-template-patcher.js"
import type { AstroAttributePatch, AstroTextPatch } from "../../types.js"
import { annotateAstroTemplate } from "../../transform/annotate.js"

// ── Expression Attributes ──────────────────────────────────────────

describe("expression attributes", () => {
  test("ternary expression: class={active ? 'on' : 'off'}", async () => {
    const source = `<div class={active ? "on" : "off"}>Hello</div>`
    const result = await patchAttributes(
      source,
      [{ action_type: "updateAstroAttribute", file: "t.astro", source: { lineNumber: 1, columnNumber: 1 }, attribute: "class", value: "always-on" }],
      "t.astro",
    )
    expect(result).toContain('class="always-on"')
    expect(result).not.toContain("active ?")
  })

  test("template literal: class={`card ${variant}`}", async () => {
    const source = "<div class={`card ${variant}`}>Content</div>"
    const result = await patchAttributes(
      source,
      [{ action_type: "updateAstroAttribute", file: "t.astro", source: { lineNumber: 1, columnNumber: 1 }, attribute: "class", value: "card-primary" }],
      "t.astro",
    )
    expect(result).toContain('class="card-primary"')
  })

  test("function call: class={cn('base', active && 'active', size === 'lg' && 'large')}", async () => {
    const source = `<div class={cn("base", active && "active", size === "lg" && "large")}>X</div>`
    const result = await patchAttributes(
      source,
      [{ action_type: "updateAstroAttribute", file: "t.astro", source: { lineNumber: 1, columnNumber: 1 }, attribute: "class", value: "simplified" }],
      "t.astro",
    )
    expect(result).toContain('class="simplified"')
    expect(result).not.toContain("cn(")
  })

  test("object expression: style={{ color: 'red', fontSize: '16px' }}", async () => {
    const source = `<div style={{ color: "red", fontSize: "16px" }}>Styled</div>`
    const result = await patchAttributes(
      source,
      [{ action_type: "updateAstroAttribute", file: "t.astro", source: { lineNumber: 1, columnNumber: 1 }, attribute: "style", value: "color: blue" }],
      "t.astro",
    )
    expect(result).toContain('style="color: blue"')
  })

  test("variable reference: href={url}", async () => {
    const source = `---\nconst url = "/about"\n---\n<a href={url}>About</a>`
    const result = await patchAttributes(
      source,
      [{ action_type: "updateAstroAttribute", file: "t.astro", source: { lineNumber: 4, columnNumber: 1 }, attribute: "href", value: "/contact" }],
      "t.astro",
    )
    expect(result).toContain('href="/contact"')
  })

  test("spread props are left alone when patching a different attr", async () => {
    const source = `<div {...props} class="hero">Content</div>`
    const result = await patchAttributes(
      source,
      [{ action_type: "updateAstroAttribute", file: "t.astro", source: { lineNumber: 1, columnNumber: 1 }, attribute: "class", value: "updated" }],
      "t.astro",
    )
    expect(result).toContain("{...props}")
    expect(result).toContain('class="updated"')
  })
})

// ── Multi-line Attributes ──────────────────────────────────────────

describe("multi-line attributes", () => {
  test("attribute split across lines", async () => {
    const source = `<div
  class="hero"
  id="main"
  data-section="top"
>Content</div>`
    const result = await patchAttributes(
      source,
      [{ action_type: "updateAstroAttribute", file: "t.astro", source: { lineNumber: 1, columnNumber: 1 }, attribute: "class", value: "updated-hero" }],
      "t.astro",
    )
    expect(result).toContain('class="updated-hero"')
    expect(result).toContain('id="main"')
    expect(result).toContain('data-section="top"')
  })
})

// ── Text Content Edge Cases ────────────────────────────────────────

describe("text content edge cases", () => {
  test("text mixed with child elements", async () => {
    // Only the direct text "Hello " should be found, not text inside <strong>
    const source = `---\n---\n<p>Hello <strong>world</strong></p>`
    const result = await patchText(
      source,
      [{ action_type: "updateAstroText", file: "t.astro", source: { lineNumber: 0, columnNumber: 0 }, oldText: "Hello", newText: "Hi" }],
      "t.astro",
    )
    expect(result).toContain("<p>Hi")
    expect(result).toContain("<strong>world</strong>")
  })

  test("text with HTML entities — entity-free text works", async () => {
    // When the text portion doesn't contain entities, it patches fine
    const source = `---\n---\n<p>Price: $100 &amp; tax included</p>`
    const result = await patchText(
      source,
      [{ action_type: "updateAstroText", file: "t.astro", source: { lineNumber: 3, columnNumber: 4 }, oldText: "Price: $100", newText: "Price: $200" }],
      "t.astro",
    )
    expect(result).toContain("$200")
    expect(result).toContain("&amp;") // entity preserved
  })

  test("text with HTML entities — known limitation: decoded entities don't match source", async () => {
    // DOM textContent decodes &amp; → &, but source has &amp;
    // The patcher searches for the decoded text in source and won't find it.
    // This is a known limitation — entities need HTML-aware matching.
    const source = `---\n---\n<p>A &amp; B</p>`
    await expect(
      patchText(
        source,
        [{ action_type: "updateAstroText", file: "t.astro", source: { lineNumber: 0, columnNumber: 0 }, oldText: "A & B", newText: "C & D" }],
        "t.astro",
      ),
    ).rejects.toThrow() // correctly throws "Text not found" rather than silently failing
  })

  test("text that appears in attribute AND as text node", async () => {
    const source = `---\n---\n<a title="Click here" href="/link">Click here</a>`
    const result = await patchText(
      source,
      [{ action_type: "updateAstroText", file: "t.astro", source: { lineNumber: 0, columnNumber: 0 }, oldText: "Click here", newText: "Go there" }],
      "t.astro",
    )
    // Should only change the text node, not the title attribute
    expect(result).toContain('title="Click here"')
    expect(result).toContain(">Go there</a>")
  })

  test("very long text content", async () => {
    const longText = "Lorem ipsum dolor sit amet, ".repeat(50).trim()
    const source = `---\n---\n<p>${longText}</p>`
    const result = await patchText(
      source,
      [{ action_type: "updateAstroText", file: "t.astro", source: { lineNumber: 0, columnNumber: 0 }, oldText: longText, newText: "Short." }],
      "t.astro",
    )
    expect(result).toContain("<p>Short.</p>")
    expect(result).not.toContain("Lorem")
  })

  test("unicode and emoji in text", async () => {
    const source = `---\n---\n<p>Hello 🌍 World — Héllo</p>`
    const result = await patchText(
      source,
      [{ action_type: "updateAstroText", file: "t.astro", source: { lineNumber: 0, columnNumber: 0 }, oldText: "Hello 🌍 World — Héllo", newText: "Hi 🚀 Earth" }],
      "t.astro",
    )
    expect(result).toContain("Hi 🚀 Earth")
  })

  test("whitespace-sensitive content inside <pre>", async () => {
    const source = `---\n---\n<pre>  line 1\n  line 2\n  line 3</pre>`
    const result = await patchText(
      source,
      [{ action_type: "updateAstroText", file: "t.astro", source: { lineNumber: 3, columnNumber: 6 }, oldText: "  line 1", newText: "  updated 1" }],
      "t.astro",
    )
    expect(result).toContain("updated 1")
    expect(result).toContain("line 2")
  })

  test("text spanning multiple lines with indentation", async () => {
    const source = `---\n---\n<p>\n  This is a paragraph\n  that spans multiple\n  lines.\n</p>`
    const result = await patchText(
      source,
      [{ action_type: "updateAstroText", file: "t.astro", source: { lineNumber: 0, columnNumber: 0 }, oldText: "This is a paragraph that spans multiple lines.", newText: "Single line now." }],
      "t.astro",
    )
    expect(result).toContain("Single line now.")
    expect(result).not.toContain("that spans")
  })
})

// ── Annotation Transform Edge Cases ────────────────────────────────

describe("annotation transform", () => {
  test("preserves expression attributes", async () => {
    const source = `---\nconst active = true\n---\n<div class={active ? "on" : "off"}>X</div>`
    const result = await annotateAstroTemplate(source, "/test.astro")
    // Should add annotations without breaking the expression
    expect(result).toContain('class={active ? "on" : "off"}')
    expect(result).toContain("data-editable-element")
  })

  test("preserves spread attributes", async () => {
    const source = `<div {...props} class="hero">Content</div>`
    const result = await annotateAstroTemplate(source, "/test.astro")
    expect(result).toContain("{...props}")
    expect(result).toContain("data-editable-element")
  })

  test("preserves .map() expressions", async () => {
    const source = `---\nconst items = ["a", "b"]\n---\n<ul>\n  {items.map(i => <li>{i}</li>)}\n</ul>`
    const result = await annotateAstroTemplate(source, "/test.astro")
    expect(result).toContain("items.map")
    expect(result).toContain('data-editable-element="ul"')
    expect(result).toContain('data-editable-element="li"')
  })

  test("preserves conditional rendering", async () => {
    const source = `---\nconst show = true\n---\n{show && <div>Visible</div>}\n{!show && <div>Hidden</div>}`
    const result = await annotateAstroTemplate(source, "/test.astro")
    expect(result).toContain("show &&")
    expect(result).toContain("data-editable-element")
  })

  test("handles slot elements", async () => {
    const source = `<div>\n  <slot />\n  <slot name="header" />\n</div>`
    const result = await annotateAstroTemplate(source, "/test.astro")
    // Slots should NOT be annotated (they're Astro internals)
    expect(result).toContain("<slot")
    // But the div should be
    expect(result).toContain('data-editable-element="div"')
  })

  test("handles deeply nested components (5+ levels)", async () => {
    const source = `---
import A from './A.astro'
import B from './B.astro'
---
<A>
  <B>
    <div>
      <section>
        <article>
          <p>Deep content</p>
        </article>
      </section>
    </div>
  </B>
</A>`
    const result = await annotateAstroTemplate(source, "/test.astro")
    expect(result).toContain('data-editable-component="A"')
    expect(result).toContain('data-editable-component="B"')
    expect(result).toContain('data-editable-element="div"')
    expect(result).toContain('data-editable-element="section"')
    expect(result).toContain('data-editable-element="article"')
    expect(result).toContain('data-editable-element="p"')
  })

  test("preserves HTML comments", async () => {
    const source = `<!-- navigation -->\n<nav>\n  <!-- links go here -->\n  <a href="/">Home</a>\n</nav>`
    const result = await annotateAstroTemplate(source, "/test.astro")
    expect(result).toContain("<!-- navigation -->")
    expect(result).toContain("<!-- links go here -->")
    expect(result).toContain('data-editable-element="nav"')
  })

  test("handles empty elements and void elements", async () => {
    const source = `<div></div>\n<br />\n<hr />\n<input type="text" />\n<img src="/logo.png" alt="" />`
    const result = await annotateAstroTemplate(source, "/test.astro")
    expect(result).toContain('data-editable-element="div"')
    expect(result).toContain('data-editable-element="br"')
    expect(result).toContain('data-editable-element="input"')
    expect(result).toContain('data-editable-element="img"')
  })
})

// ── CSS Patcher Complexity (via PostCSS in css package) ────────────
// These test the patterns we'd encounter when editing styles

describe("complex CSS variable values (annotation round-trip)", () => {
  test("annotates elements with complex inline styles", async () => {
    const source = `<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);">Complex</div>`
    const result = await annotateAstroTemplate(source, "/test.astro")
    // Should preserve the complex style value
    expect(result).toContain("linear-gradient")
    expect(result).toContain("box-shadow")
    expect(result).toContain("data-editable-element")
  })

  test("annotates elements with calc() in style", async () => {
    const source = `<div style="width: calc(100% - 2rem); margin: calc(var(--spacing) * 2);">Calc</div>`
    const result = await annotateAstroTemplate(source, "/test.astro")
    expect(result).toContain("calc(100%")
    expect(result).toContain("var(--spacing)")
  })
})

// ── Multiple Patches in One Save ───────────────────────────────────

describe("multiple patches", () => {
  test("patch class and add id in one save", async () => {
    const source = `<div class="old">Content</div>`
    const patches: AstroAttributePatch[] = [
      { action_type: "updateAstroAttribute", file: "t.astro", source: { lineNumber: 1, columnNumber: 1 }, attribute: "class", value: "new" },
      { action_type: "updateAstroAttribute", file: "t.astro", source: { lineNumber: 1, columnNumber: 1 }, attribute: "id", value: "added" },
    ]
    const result = await patchAttributes(source, patches, "t.astro")
    expect(result).toContain('class="new"')
    expect(result).toContain('id="added"')
  })

  test("patch two different elements", async () => {
    const source = `<h1 class="title">Title</h1>\n<p class="body">Body</p>`
    const patches: AstroAttributePatch[] = [
      { action_type: "updateAstroAttribute", file: "t.astro", source: { lineNumber: 1, columnNumber: 1 }, attribute: "class", value: "new-title" },
      { action_type: "updateAstroAttribute", file: "t.astro", source: { lineNumber: 2, columnNumber: 1 }, attribute: "class", value: "new-body" },
    ]
    const result = await patchAttributes(source, patches, "t.astro")
    expect(result).toContain('class="new-title"')
    expect(result).toContain('class="new-body"')
  })
})
