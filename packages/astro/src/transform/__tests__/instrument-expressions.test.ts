import { describe, expect, test } from "bun:test"
import { classifyExpression } from "../instrument-expressions.js"

describe("classifyExpression", () => {
  test("pure string literal (double quotes)", () => {
    const result = classifyExpression('"hero container"')
    expect(result.source).toBe("literal")
  })

  test("pure string literal (single quotes)", () => {
    const result = classifyExpression("'hero'")
    expect(result.source).toBe("literal")
  })

  test("pure variable reference", () => {
    const result = classifyExpression("className")
    expect(result.source).toBe("variable")
    expect(result.variableName).toBe("className")
  })

  test("member expression variable", () => {
    const result = classifyExpression("props.className")
    expect(result.source).toBe("variable")
    expect(result.variableName).toBe("props.className")
  })

  test("optional chaining variable", () => {
    const result = classifyExpression("props?.className")
    expect(result.source).toBe("variable")
  })

  test("ternary expression", () => {
    const result = classifyExpression('active ? "on" : "off"')
    expect(result.source).toBe("expression")
  })

  test("function call", () => {
    const result = classifyExpression('cn("base", "extra")')
    expect(result.source).toBe("expression")
  })

  test("logical expression", () => {
    const result = classifyExpression('active && "highlight"')
    expect(result.source).toBe("expression")
  })

  test("template literal", () => {
    const result = classifyExpression("`card ${variant}`")
    expect(result.source).toBe("expression")
  })

  test("array expression", () => {
    const result = classifyExpression('["a", "b"].join(" ")')
    expect(result.source).toBe("expression")
  })

  test("empty string literal", () => {
    const result = classifyExpression('""')
    expect(result.source).toBe("literal")
  })
})
