import type { ControlType } from "../types.js"

/**
 * Detect the appropriate control type for a CSS value.
 */
export function inferControlType(name: string, value: string): ControlType {
  // Color detection
  if (isColorValue(value)) return "color"

  // Numeric with unit detection
  if (/^-?[\d.]+(?:px|rem|em|vh|vw|%|ch|ex|vmin|vmax|dvh|svh|lvh)$/.test(value)) {
    return "slider"
  }

  return "text"
}

/**
 * Check if a CSS value represents a color.
 */
export function isColorValue(value: string): boolean {
  // Hex colors
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return true
  // rgb/rgba/hsl/hsla/oklch/etc
  if (/^(?:rgb|rgba|hsl|hsla|oklch|oklab|lch|lab|hwb|color)\s*\(/.test(value)) return true
  // Named colors (common subset)
  const named = new Set([
    "transparent", "currentcolor",
    "black", "white", "red", "green", "blue", "yellow", "orange", "purple",
    "pink", "gray", "grey", "cyan", "magenta", "lime", "navy", "teal",
    "maroon", "olive", "aqua", "fuchsia", "silver", "coral", "salmon",
    "tomato", "gold", "wheat", "ivory", "beige", "khaki", "plum",
  ])
  if (named.has(value.toLowerCase())) return true
  return false
}

/**
 * Parse a numeric CSS value into its number and unit parts.
 */
export function parseNumericValue(value: string): {
  number: number
  unit: string
} | null {
  const match = value.match(/^(-?[\d.]+)(px|rem|em|vh|vw|%|ch|ex|vmin|vmax|dvh|svh|lvh)$/)
  if (!match) return null
  return { number: parseFloat(match[1]), unit: match[2] }
}

/**
 * Get reasonable slider bounds for a CSS unit.
 */
export function getSliderBounds(unit: string, current: number): {
  min: number
  max: number
  step: number
} {
  switch (unit) {
    case "px":
      return { min: 0, max: Math.max(2000, current * 2), step: 1 }
    case "rem":
    case "em":
      return { min: 0, max: Math.max(10, current * 2), step: 0.125 }
    case "vh":
    case "vw":
    case "%":
    case "dvh":
    case "svh":
    case "lvh":
      return { min: 0, max: 100, step: 1 }
    default:
      return { min: 0, max: Math.max(100, current * 2), step: 1 }
  }
}

/**
 * Convert an rgba() or rgb() CSS value to a hex color for the color picker input.
 * Returns the original value if it can't be converted.
 */
export function toHexColor(value: string): string {
  // Already hex
  if (/^#[0-9a-f]{6}$/i.test(value)) return value
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const [, r, g, b] = value.match(/^#(.)(.)(.)$/)!
    return `#${r}${r}${g}${g}${b}${b}`
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = value.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)/,
  )
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0")
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0")
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0")
    return `#${r}${g}${b}`
  }

  // hsl(h, s%, l%) or hsla(h, s%, l%, a)
  const hslMatch = value.match(
    /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*[\d.]+\s*)?\)/,
  )
  if (hslMatch) {
    return hslToHex(
      parseFloat(hslMatch[1]),
      parseFloat(hslMatch[2]),
      parseFloat(hslMatch[3]),
    )
  }

  // oklch, oklab, lch, lab, hwb, color() — cannot convert accurately in JS
  // without a full color science library. Return a neutral gray fallback so
  // <input type="color"> doesn't silently show black.
  if (/^(?:oklch|oklab|lch|lab|hwb|color)\s*\(/.test(value)) {
    return "#808080"
  }

  return value
}

// ── DOM helpers for creating controls ────────────────────

/**
 * Create a color picker control.
 */
export function createColorControl(
  value: string,
  onChange: (newValue: string) => void,
): HTMLElement {
  const wrapper = document.createElement("div")
  wrapper.className = "var-control"

  const swatch = document.createElement("div")
  swatch.className = "color-swatch"
  swatch.style.background = value

  const colorInput = document.createElement("input")
  colorInput.type = "color"
  colorInput.value = toHexColor(value)
  colorInput.addEventListener("input", () => {
    const newVal = colorInput.value
    swatch.style.background = newVal
    textInput.value = newVal
    onChange(newVal)
  })
  swatch.appendChild(colorInput)

  const textInput = document.createElement("input")
  textInput.className = "var-input color-text"
  textInput.value = value
  textInput.addEventListener("change", () => {
    const newVal = textInput.value
    swatch.style.background = newVal
    if (isColorValue(newVal)) {
      colorInput.value = toHexColor(newVal)
    }
    onChange(newVal)
  })

  wrapper.appendChild(swatch)
  wrapper.appendChild(textInput)
  return wrapper
}

/**
 * Create a slider control for numeric values.
 */
export function createSliderControl(
  value: string,
  onChange: (newValue: string) => void,
): HTMLElement {
  const parsed = parseNumericValue(value)
  if (!parsed) return createTextControl(value, onChange)

  const { number: num, unit } = parsed
  const bounds = getSliderBounds(unit, num)

  const wrapper = document.createElement("div")
  wrapper.className = "var-control"

  const row = document.createElement("div")
  row.className = "slider-row"

  const slider = document.createElement("input")
  slider.type = "range"
  slider.className = "slider-input"
  slider.min = String(bounds.min)
  slider.max = String(bounds.max)
  slider.step = String(bounds.step)
  slider.value = String(num)

  const numberInput = document.createElement("input")
  numberInput.type = "number"
  numberInput.className = "slider-number"
  numberInput.value = String(num)
  numberInput.step = String(bounds.step)

  const unitLabel = document.createElement("span")
  unitLabel.className = "slider-unit"
  unitLabel.textContent = unit

  slider.addEventListener("input", () => {
    numberInput.value = slider.value
    onChange(`${slider.value}${unit}`)
  })

  numberInput.addEventListener("change", () => {
    slider.value = numberInput.value
    onChange(`${numberInput.value}${unit}`)
  })

  row.appendChild(slider)
  row.appendChild(numberInput)
  row.appendChild(unitLabel)
  wrapper.appendChild(row)
  return wrapper
}

/**
 * Create a plain text input control.
 */
export function createTextControl(
  value: string,
  onChange: (newValue: string) => void,
): HTMLElement {
  const wrapper = document.createElement("div")
  wrapper.className = "var-control"

  const input = document.createElement("input")
  input.className = "var-input"
  input.value = value
  input.addEventListener("change", () => onChange(input.value))

  wrapper.appendChild(input)
  return wrapper
}

/**
 * Create the appropriate control based on the CSS value.
 */
export function createControl(
  name: string,
  value: string,
  onChange: (newValue: string) => void,
): HTMLElement {
  const type = inferControlType(name, value)
  switch (type) {
    case "color":
      return createColorControl(value, onChange)
    case "slider":
      return createSliderControl(value, onChange)
    default:
      return createTextControl(value, onChange)
  }
}

// ── Internal helpers ───────────────────────────────────────────────

/**
 * Convert HSL values to a hex color string.
 * h: 0-360, s: 0-100, l: 0-100
 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100

  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * Math.max(0, Math.min(1, color)))
      .toString(16)
      .padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
