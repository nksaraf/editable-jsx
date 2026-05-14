import { describe, expect, test } from "bun:test"
import { inferActiveLiterals, type ExpressionLiteral } from "../expression-field.js"

describe("inferActiveLiterals", () => {
  test("ternary: active ? 'on' : 'off' → rendered 'on'", () => {
    const literals: ExpressionLiteral[] = [
      { value: "on", offset: 9, quote: '"', context: "ternary-consequent" },
      { value: "off", offset: 16, quote: '"', context: "ternary-alternate" },
    ]
    const result = inferActiveLiterals(literals, "on")
    expect(result.get(9)).toBe(true) // "on" is active
    expect(result.get(16)).toBe(false) // "off" is inactive
  })

  test("ternary: active ? 'on' : 'off' → rendered 'off'", () => {
    const literals: ExpressionLiteral[] = [
      { value: "on", offset: 9, quote: '"', context: "ternary-consequent" },
      { value: "off", offset: 16, quote: '"', context: "ternary-alternate" },
    ]
    const result = inferActiveLiterals(literals, "off")
    expect(result.get(9)).toBe(false) // "on" is inactive
    expect(result.get(16)).toBe(true) // "off" is active
  })

  test("cn() all args active: cn('base', 'extra') → rendered 'base extra'", () => {
    const literals: ExpressionLiteral[] = [
      { value: "base", offset: 3, quote: '"', context: "call-arg" },
      { value: "extra", offset: 11, quote: '"', context: "call-arg" },
    ]
    const result = inferActiveLiterals(literals, "base extra")
    expect(result.get(3)).toBe(true)
    expect(result.get(11)).toBe(true)
  })

  test("cn() conditional inactive: cn('base', active && 'highlight') → rendered 'base'", () => {
    const literals: ExpressionLiteral[] = [
      { value: "base", offset: 3, quote: '"', context: "call-arg" },
      { value: "highlight", offset: 21, quote: '"', context: "conditional" },
    ]
    const result = inferActiveLiterals(literals, "base")
    expect(result.get(3)).toBe(true) // "base" is active
    expect(result.get(21)).toBe(false) // "highlight" is inactive (condition was false)
  })

  test("cn() conditional active: cn('base', active && 'highlight') → rendered 'base highlight'", () => {
    const literals: ExpressionLiteral[] = [
      { value: "base", offset: 3, quote: '"', context: "call-arg" },
      { value: "highlight", offset: 21, quote: '"', context: "conditional" },
    ]
    const result = inferActiveLiterals(literals, "base highlight")
    expect(result.get(3)).toBe(true)
    expect(result.get(21)).toBe(true)
  })

  test("multi-word classes: 'ring-2 ring-blue-500' checked as individual classes", () => {
    const literals: ExpressionLiteral[] = [
      { value: "rounded-lg border", offset: 3, quote: '"', context: "call-arg" },
      { value: "ring-2 ring-blue-500", offset: 30, quote: '"', context: "conditional" },
    ]
    const result = inferActiveLiterals(literals, "rounded-lg border ring-2 ring-blue-500")
    expect(result.get(3)).toBe(true)
    expect(result.get(30)).toBe(true)
  })

  test("multi-word classes inactive when not all present", () => {
    const literals: ExpressionLiteral[] = [
      { value: "rounded-lg border", offset: 3, quote: '"', context: "call-arg" },
      { value: "ring-2 ring-blue-500", offset: 30, quote: '"', context: "conditional" },
    ]
    // Only "rounded-lg border" present, not "ring-2 ring-blue-500"
    const result = inferActiveLiterals(literals, "rounded-lg border")
    expect(result.get(3)).toBe(true)
    expect(result.get(30)).toBe(false)
  })

  test("empty string literal is always active", () => {
    const literals: ExpressionLiteral[] = [
      { value: "", offset: 0, quote: '"', context: "call-arg" },
      { value: "active", offset: 5, quote: '"', context: "conditional" },
    ]
    const result = inferActiveLiterals(literals, "active")
    expect(result.get(0)).toBe(true) // empty is always active
    expect(result.get(5)).toBe(true)
  })

  test("non-class attribute: style value match", () => {
    const literals: ExpressionLiteral[] = [
      { value: "block", offset: 9, quote: '"', context: "ternary-consequent" },
      { value: "none", offset: 20, quote: '"', context: "ternary-alternate" },
    ]
    const result = inferActiveLiterals(literals, "block")
    expect(result.get(9)).toBe(true)
    expect(result.get(20)).toBe(false)
  })
})
