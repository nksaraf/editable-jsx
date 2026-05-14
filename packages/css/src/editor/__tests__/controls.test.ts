import { describe, expect, test } from "bun:test"
import { toHexColor, hslToHex, isColorValue } from "../controls.js"

describe("toHexColor", () => {
  test("returns 6-digit hex unchanged", () => {
    expect(toHexColor("#ff0000")).toBe("#ff0000")
  })

  test("expands 3-digit hex to 6-digit", () => {
    expect(toHexColor("#f00")).toBe("#ff0000")
    expect(toHexColor("#abc")).toBe("#aabbcc")
  })

  test("converts rgb() to hex", () => {
    expect(toHexColor("rgb(255, 0, 0)")).toBe("#ff0000")
    expect(toHexColor("rgb(0, 128, 255)")).toBe("#0080ff")
  })

  test("converts rgba() to hex (ignoring alpha)", () => {
    expect(toHexColor("rgba(255, 128, 0, 0.5)")).toBe("#ff8000")
  })

  test("converts hsl() to hex", () => {
    // hsl(0, 100%, 50%) = pure red
    expect(toHexColor("hsl(0, 100%, 50%)")).toBe("#ff0000")
    // hsl(120, 100%, 50%) = pure green
    expect(toHexColor("hsl(120, 100%, 50%)")).toBe("#00ff00")
    // hsl(240, 100%, 50%) = pure blue
    expect(toHexColor("hsl(240, 100%, 50%)")).toBe("#0000ff")
  })

  test("converts hsla() to hex (ignoring alpha)", () => {
    expect(toHexColor("hsla(0, 100%, 50%, 0.5)")).toBe("#ff0000")
  })

  test("returns #808080 for oklch()", () => {
    expect(toHexColor("oklch(0.7 0.15 180)")).toBe("#808080")
  })

  test("returns #808080 for oklab()", () => {
    expect(toHexColor("oklab(0.7 -0.1 0.1)")).toBe("#808080")
  })

  test("returns #808080 for lch()", () => {
    expect(toHexColor("lch(50 100 180)")).toBe("#808080")
  })

  test("returns #808080 for hwb()", () => {
    expect(toHexColor("hwb(0 0% 0%)")).toBe("#808080")
  })

  test("returns #808080 for color()", () => {
    expect(toHexColor("color(display-p3 1 0.5 0)")).toBe("#808080")
  })

  test("returns named colors unchanged (no conversion needed)", () => {
    expect(toHexColor("red")).toBe("red")
  })
})

describe("hslToHex", () => {
  test("pure red", () => {
    expect(hslToHex(0, 100, 50)).toBe("#ff0000")
  })

  test("pure green", () => {
    expect(hslToHex(120, 100, 50)).toBe("#00ff00")
  })

  test("pure blue", () => {
    expect(hslToHex(240, 100, 50)).toBe("#0000ff")
  })

  test("white", () => {
    expect(hslToHex(0, 0, 100)).toBe("#ffffff")
  })

  test("black", () => {
    expect(hslToHex(0, 0, 0)).toBe("#000000")
  })

  test("50% gray", () => {
    expect(hslToHex(0, 0, 50)).toBe("#808080")
  })
})

describe("isColorValue", () => {
  test("recognizes oklch as a color", () => {
    expect(isColorValue("oklch(0.7 0.15 180)")).toBe(true)
  })

  test("recognizes hsl as a color", () => {
    expect(isColorValue("hsl(0, 100%, 50%)")).toBe(true)
  })

  test("recognizes hsla as a color", () => {
    expect(isColorValue("hsla(0, 100%, 50%, 1)")).toBe(true)
  })
})
