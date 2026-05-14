import { describe, expect, test } from "bun:test"
import { replaceAtOffset, replaceAtPosition, replaceNormalized } from "../text-patcher.js"

describe("replaceAtOffset", () => {
  test("replaces at exact offset", () => {
    const result = replaceAtOffset("hello world", 6, "world", "earth")
    expect(result).toBe("hello earth")
  })

  test("throws on mismatch", () => {
    expect(() => replaceAtOffset("hello world", 6, "wrong", "new")).toThrow("Text mismatch")
  })

  test("handles beginning of string", () => {
    const result = replaceAtOffset("hello world", 0, "hello", "hi")
    expect(result).toBe("hi world")
  })
})

describe("replaceAtPosition", () => {
  test("replaces at line:col", () => {
    const source = "line1\nline2 target here\nline3"
    const result = replaceAtPosition(source, 2, 7, "target", "replaced")
    expect(result).toBe("line1\nline2 replaced here\nline3")
  })

  test("falls back to normalized search when position misses", () => {
    const source = "---\n---\n<h1>Hello World</h1>"
    const result = replaceAtPosition(source, 99, 1, "Hello World", "Goodbye", {
      skipFrontmatter: true,
    })
    expect(result).toContain("Goodbye")
  })

  test("fallback with line 0 goes directly to normalized", () => {
    const source = "<p>\n  Multi line\n  text here\n</p>"
    const result = replaceAtPosition(source, 0, 0, "Multi line text here", "Single line", {})
    expect(result).toContain("Single line")
  })
})

describe("replaceNormalized", () => {
  test("matches multi-line text as single line", () => {
    const source = "<p>\n  This text spans\n  multiple lines.\n</p>"
    const result = replaceNormalized(source, "This text spans multiple lines.", "Replaced.")
    expect(result).toContain("Replaced.")
    expect(result).not.toContain("This text spans")
  })

  test("skips attribute context when textNodeOnly is true", () => {
    const source = '<div title="Hello World">Hello World</div>'
    const result = replaceNormalized(source, "Hello World", "Changed", { textNodeOnly: true })
    expect(result).toContain('title="Hello World"') // attribute preserved
    expect(result).toContain(">Changed</div>") // text node changed
  })

  test("skips frontmatter when skipFrontmatter is true", () => {
    const source = '---\nconst x = "target"\n---\n<p>target</p>'
    const result = replaceNormalized(source, "target", "replaced", { skipFrontmatter: true })
    expect(result).toContain('const x = "target"') // frontmatter preserved
    expect(result).toContain("<p>replaced</p>")
  })

  test("skips style blocks when skipStyleBlocks is true", () => {
    const source = "<p>hello</p>\n<style>.hello { color: red; }</style>"
    const result = replaceNormalized(source, "hello", "world", { skipStyleBlocks: true })
    expect(result).toContain("<p>world</p>")
    expect(result).toContain(".hello") // style block preserved
  })

  test("throws when text not found", () => {
    expect(() => replaceNormalized("<p>abc</p>", "xyz", "new")).toThrow("Text not found")
  })

  test("throws on empty search text", () => {
    expect(() => replaceNormalized("<p>abc</p>", "  ", "new")).toThrow("empty")
  })

  test("handles unicode and emoji", () => {
    const source = "<p>Hello 🌍 World</p>"
    const result = replaceNormalized(source, "Hello 🌍 World", "Hi 🚀")
    expect(result).toContain("Hi 🚀")
  })
})
