import { describe, expect, test } from "bun:test"
import {
  extractStringLiterals,
  replaceStringLiteral,
} from "../expression-parser.js"
import { patchExpressions } from "../astro-template-patcher.js"
import type { AstroExpressionPatch } from "../../types.js"

// ── extractStringLiterals ──────────────────────────────────────────

describe("extractStringLiterals", () => {
  test("ternary: active ? 'on' : 'off'", () => {
    const expr = `active ? "on" : "off"`
    const result = extractStringLiterals(expr)
    expect(result).toHaveLength(2)
    expect(result[0].value).toBe("on")
    expect(result[0].context).toBe("ternary-consequent")
    expect(result[1].value).toBe("off")
    expect(result[1].context).toBe("ternary-alternate")
  })

  test("cn() call with conditional: cn('base', active && 'active')", () => {
    const expr = `cn("base", active && "active")`
    const result = extractStringLiterals(expr)
    expect(result).toHaveLength(2)
    expect(result[0].value).toBe("base")
    expect(result[0].context).toBe("call-arg")
    expect(result[1].value).toBe("active")
    expect(result[1].context).toBe("conditional")
  })

  test("template literal: `card ${variant}`", () => {
    const expr = "`card ${variant}`"
    const result = extractStringLiterals(expr)
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe("card ")
    expect(result[0].context).toBe("template-static")
  })

  test("template literal with multiple parts: `${a}-${b}-end`", () => {
    const expr = "`${a}-${b}-end`"
    const result = extractStringLiterals(expr)
    expect(result).toHaveLength(2)
    expect(result[0].value).toBe("-")
    expect(result[1].value).toBe("-end")
  })

  test("complex cn with multiple conditions", () => {
    const expr = `cn("rounded-lg", "border", isSelected && "ring-2 ring-blue-500", isHovered && !isSelected && "ring-2 ring-yellow-400")`
    const result = extractStringLiterals(expr)
    expect(result).toHaveLength(4)
    expect(result[0].value).toBe("rounded-lg")
    expect(result[1].value).toBe("border")
    expect(result[2].value).toBe("ring-2 ring-blue-500")
    expect(result[3].value).toBe("ring-2 ring-yellow-400")
  })

  test("object expression: { color: 'red', fontSize: '16px' }", () => {
    const expr = `{ color: "red", fontSize: "16px" }`
    const result = extractStringLiterals(expr)
    expect(result).toHaveLength(2)
    expect(result[0].value).toBe("red")
    expect(result[1].value).toBe("16px")
  })

  test("escaped quotes in string", () => {
    const expr = `"hello \\"world\\""`
    const result = extractStringLiterals(expr)
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe('hello "world"')
  })

  test("single quotes", () => {
    const expr = `active ? 'on' : 'off'`
    const result = extractStringLiterals(expr)
    expect(result).toHaveLength(2)
    expect(result[0].value).toBe("on")
    expect(result[1].value).toBe("off")
  })

  test("empty string", () => {
    const expr = `""`
    const result = extractStringLiterals(expr)
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe("")
  })

  test("no strings (pure expression)", () => {
    const expr = "a + b * c"
    const result = extractStringLiterals(expr)
    expect(result).toHaveLength(0)
  })
})

// ── replaceStringLiteral ───────────────────────────────────────────

describe("replaceStringLiteral", () => {
  test("replaces a double-quoted string", () => {
    const expr = `active ? "on" : "off"`
    const result = replaceStringLiteral(expr, 9, "on", "active")
    expect(result).toBe(`active ? "active" : "off"`)
  })

  test("replaces the alternate branch", () => {
    const expr = `active ? "on" : "off"`
    const result = replaceStringLiteral(expr, 16, "off", "inactive")
    expect(result).toBe(`active ? "on" : "inactive"`)
  })

  test("replaces inside cn() call", () => {
    const expr = `cn("base", active && "active")`
    const result = replaceStringLiteral(expr, 3, "base", "new-base")
    expect(result).toBe(`cn("new-base", active && "active")`)
  })

  test("replaces a single-quoted string", () => {
    const expr = `active ? 'on' : 'off'`
    const result = replaceStringLiteral(expr, 9, "on", "yes")
    expect(result).toBe(`active ? 'yes' : 'off'`)
  })

  test("replaces static part of template literal", () => {
    const expr = "`card ${variant}`"
    // offset 1 is the 'c' (start of static content, not a quote)
    const result = replaceStringLiteral(expr, 1, "card ", "btn ")
    expect(result).toBe("`btn ${variant}`")
  })

  test("throws on wrong offset", () => {
    const expr = `"hello"`
    expect(() => replaceStringLiteral(expr, 3, "x", "y")).toThrow()
  })

  test("throws on value mismatch", () => {
    const expr = `"hello"`
    expect(() => replaceStringLiteral(expr, 0, "wrong", "new")).toThrow(
      'Expected "wrong"',
    )
  })
})

// ── Full pipeline: patchExpressions ────────────────────────────────

describe("patchExpressions (full pipeline)", () => {
  test("edit one branch of a ternary class", async () => {
    const source = `<div class={active ? "on" : "off"}>Hello</div>`
    const patches: AstroExpressionPatch[] = [
      {
        action_type: "updateAstroExpression",
        file: "t.astro",
        source: { lineNumber: 1, columnNumber: 1 },
        attribute: "class",
        oldLiteral: "on",
        newLiteral: "active-state",
        literalOffset: 9,
      },
    ]
    const result = await patchExpressions(source, patches, "t.astro")
    expect(result).toContain('"active-state"')
    expect(result).toContain('"off"') // other branch preserved
    expect(result).toContain("active ?") // ternary structure preserved
  })

  test("edit a cn() argument", async () => {
    const source = `<div class={cn("base", active && "highlight")}>Content</div>`
    const patches: AstroExpressionPatch[] = [
      {
        action_type: "updateAstroExpression",
        file: "t.astro",
        source: { lineNumber: 1, columnNumber: 1 },
        attribute: "class",
        oldLiteral: "base",
        newLiteral: "card rounded-lg",
        literalOffset: 3,
      },
    ]
    const result = await patchExpressions(source, patches, "t.astro")
    expect(result).toContain('"card rounded-lg"')
    expect(result).toContain('"highlight"') // other arg preserved
    expect(result).toContain("active &&") // conditional preserved
  })

  test("edit template literal static part", async () => {
    const source = "<div class={`card ${variant}`}>Content</div>"
    const patches: AstroExpressionPatch[] = [
      {
        action_type: "updateAstroExpression",
        file: "t.astro",
        source: { lineNumber: 1, columnNumber: 1 },
        attribute: "class",
        oldLiteral: "card ",
        newLiteral: "btn ",
        literalOffset: 1,
      },
    ]
    const result = await patchExpressions(source, patches, "t.astro")
    expect(result).toContain("`btn ${variant}`")
  })

  test("edit style object value", async () => {
    const source = `<div style={{ color: "red", fontSize: "16px" }}>Styled</div>`
    // In the expression { color: "red", fontSize: "16px" }, "red" is at offset 9
    const patches: AstroExpressionPatch[] = [
      {
        action_type: "updateAstroExpression",
        file: "t.astro",
        source: { lineNumber: 1, columnNumber: 1 },
        attribute: "style",
        oldLiteral: "red",
        newLiteral: "blue",
        literalOffset: 9,
      },
    ]
    const result = await patchExpressions(source, patches, "t.astro")
    expect(result).toContain('"blue"')
    expect(result).toContain('"16px"') // other property preserved
    expect(result).toContain("fontSize:") // key preserved
  })

  test("preserves expression structure with complex cn()", async () => {
    const source = `<div class={cn("rounded-lg group/card border", isSelected && "ring-2 ring-blue-500", isHovered && !isSelected && "ring-2 ring-yellow-400")}>X</div>`
    // In the expression, "ring-2 ring-blue-500" is at offset 49
    const patches: AstroExpressionPatch[] = [
      {
        action_type: "updateAstroExpression",
        file: "t.astro",
        source: { lineNumber: 1, columnNumber: 1 },
        attribute: "class",
        oldLiteral: "ring-2 ring-blue-500",
        newLiteral: "ring-4 ring-green-500 shadow-lg",
        literalOffset: 49,
      },
    ]
    const result = await patchExpressions(source, patches, "t.astro")
    expect(result).toContain('"ring-4 ring-green-500 shadow-lg"')
    expect(result).toContain('"rounded-lg group/card border"') // base preserved
    expect(result).toContain("isSelected &&") // conditional preserved
    expect(result).toContain('"ring-2 ring-yellow-400"') // other conditional preserved
  })
})
