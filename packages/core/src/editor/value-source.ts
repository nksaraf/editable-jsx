/**
 * Value Source Indicator — shows whether a value came from
 * a string literal, a variable, or a complex expression.
 *
 * For literal: class="hero"
 *   → [literal] "hero" — editable directly
 *
 * For variable: class={className}
 *   → [variable] className → "hero container" — edit in source
 *
 * For expression: class={cn("base", active && "active")}
 *   → [expression] cn("base", ...) — edit string literals
 */

export type ValueSource = "literal" | "variable" | "expression"

/**
 * Create a value source indicator element.
 *
 * @param source — the source type
 * @param detail — additional context (variable name, expression preview)
 * @returns the DOM element
 */
export function createValueSourceIndicator(
  source: ValueSource,
  detail?: string,
): HTMLElement {
  const container = document.createElement("div")
  container.className = "value-source"

  const badge = document.createElement("span")
  badge.className = `value-source-badge ${source}`
  badge.textContent = source

  container.appendChild(badge)

  if (detail) {
    const detailSpan = document.createElement("span")
    detailSpan.textContent = detail
    detailSpan.style.fontFamily = "ui-monospace, monospace"
    container.appendChild(detailSpan)
  }

  // Add context-specific hint
  const hint = document.createElement("span")
  hint.style.color = "#334155"

  switch (source) {
    case "literal":
      hint.textContent = "— editable"
      break
    case "variable":
      hint.textContent = "— edit in source"
      break
    case "expression":
      hint.textContent = "— edit string parts"
      break
  }

  container.appendChild(hint)

  return container
}
