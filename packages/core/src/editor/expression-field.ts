/**
 * Expression Field — renders an interactive UI for editing string
 * literals inside JavaScript expressions.
 *
 * Given class={active ? "on" : "off"} with rendered value "on", renders:
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │ active ?  [if ✓: on_____]  :  [else: off____]   │
 *   │           ACTIVE (green)      inactive (dim)     │
 *   │                                       [raw]      │
 *   └──────────────────────────────────────────────────┘
 *
 * The "active" state is inferred by comparing the rendered DOM value
 * against each string literal. Literals whose value appears in the
 * rendered output are marked active; others are dimmed.
 *
 * This is framework-agnostic — works for both React JSX and Astro.
 */

export interface ExpressionLiteral {
  value: string
  offset: number
  quote: string
  context: string
}

export interface ExpressionChange {
  offset: number
  oldValue: string
  newValue: string
}

/**
 * Determine which string literals are "active" (present in the rendered value).
 *
 * For class={active ? "on" : "off"} with rendered "on":
 * - "on" → active (it's in the output)
 * - "off" → inactive (it's not)
 *
 * For class={cn("base", active && "highlight")} with rendered "base highlight":
 * - "base" → active
 * - "highlight" → active (both are in the output)
 *
 * For class={cn("base", active && "highlight")} with rendered "base":
 * - "base" → active
 * - "highlight" → inactive (conditional was false)
 */
export function inferActiveLiterals(
  literals: ExpressionLiteral[],
  renderedValue: string,
): Map<number, boolean> {
  const result = new Map<number, boolean>()

  for (const lit of literals) {
    if (!lit.value) {
      // Empty strings are always "active" (they don't add anything)
      result.set(lit.offset, true)
      continue
    }

    // Check if this literal's value appears in the rendered output.
    // For class values, the rendered output is space-separated classes,
    // so we check if the literal is a substring or if all its classes are present.
    const literalClasses = lit.value.split(/\s+/).filter(Boolean)
    const renderedClasses = renderedValue.split(/\s+/).filter(Boolean)

    if (literalClasses.length > 0 && literalClasses.every((c) => renderedClasses.includes(c))) {
      result.set(lit.offset, true)
    } else if (renderedValue.includes(lit.value)) {
      // Direct substring match (for non-class attributes)
      result.set(lit.offset, true)
    } else {
      result.set(lit.offset, false)
    }
  }

  return result
}

/**
 * Create an interactive expression editor.
 *
 * @param expression — the raw expression string (between { and })
 * @param literals — the editable string literals extracted from the expression
 * @param renderedValue — the current rendered value from the DOM (null if unknown)
 * @param onChange — called when any literal is edited
 * @returns the DOM element for the editor
 */
export function createExpressionField(
  expression: string,
  literals: ExpressionLiteral[],
  renderedValue: string | null,
  onChange: (changes: ExpressionChange[]) => void,
): HTMLElement {
  const container = document.createElement("div")
  container.className = "expr-field"

  // Infer which literals are active
  const activeMap = renderedValue
    ? inferActiveLiterals(literals, renderedValue)
    : null

  // Track pending changes
  const pendingChanges = new Map<number, ExpressionChange>()

  // ── Structured view ────────────────────────────────────

  const structuredView = document.createElement("div")
  structuredView.className = "expr-structured"

  if (literals.length === 0) {
    // No editable literals — show as read-only
    const readOnly = document.createElement("span")
    readOnly.className = "expr-readonly"
    readOnly.textContent = expression
    readOnly.title = "No editable string literals in this expression"
    structuredView.appendChild(readOnly)
  } else {
    // Build the interleaved view: code segments + editable fields
    let lastEnd = 0

    for (const lit of literals) {
      // Code segment before this literal
      const codeBefore = expression.slice(lastEnd, lit.offset)
      if (codeBefore.trim()) {
        const codeSpan = document.createElement("span")
        codeSpan.className = "expr-code"
        codeSpan.textContent = codeBefore.trim()
        structuredView.appendChild(codeSpan)
      }

      // Is this literal active (matches rendered value)?
      const isActive = activeMap?.get(lit.offset) ?? null

      // Editable field for the string literal
      const field = createLiteralField(lit, isActive, (newValue) => {
        if (newValue !== lit.value) {
          pendingChanges.set(lit.offset, {
            offset: lit.offset,
            oldValue: lit.value,
            newValue,
          })
        } else {
          pendingChanges.delete(lit.offset)
        }
        onChange(Array.from(pendingChanges.values()))
      })
      structuredView.appendChild(field)

      // Calculate end of this literal in the expression
      if (lit.quote === "`") {
        lastEnd = lit.offset + lit.value.length
      } else {
        lastEnd = lit.offset + lit.value.length + 2 // +2 for quotes
      }
    }

    // Trailing code after the last literal
    const trailingCode = expression.slice(lastEnd).trim()
    if (trailingCode) {
      const trailSpan = document.createElement("span")
      trailSpan.className = "expr-code"
      trailSpan.textContent = trailingCode
      structuredView.appendChild(trailSpan)
    }
  }

  // ── Rendered value indicator ───────────────────────────

  if (renderedValue !== null) {
    const rendered = document.createElement("div")
    rendered.className = "expr-rendered"
    rendered.title = "Current rendered value from the DOM"

    const label = document.createElement("span")
    label.className = "expr-rendered-label"
    label.textContent = "rendered:"

    const val = document.createElement("span")
    val.className = "expr-rendered-value"
    val.textContent = renderedValue || "(empty)"

    rendered.appendChild(label)
    rendered.appendChild(val)
    structuredView.insertBefore(rendered, structuredView.firstChild)
  }

  // ── Raw view (hidden by default) ───────────────────────

  const rawView = document.createElement("div")
  rawView.className = "expr-raw"
  rawView.style.display = "none"

  const rawTextarea = document.createElement("textarea")
  rawTextarea.className = "text-edit-input"
  rawTextarea.value = expression
  rawTextarea.rows = Math.min(6, expression.split("\n").length + 1)
  rawTextarea.style.fontFamily = "ui-monospace, monospace"
  rawTextarea.style.fontSize = "11px"
  rawView.appendChild(rawTextarea)

  // ── Toggle button ──────────────────────────────────────

  const toggleRow = document.createElement("div")
  toggleRow.style.cssText =
    "display:flex;justify-content:flex-end;margin-top:4px"

  const toggleBtn = document.createElement("button")
  toggleBtn.className = "btn btn-secondary"
  toggleBtn.style.cssText = "padding:2px 6px;font-size:10px"
  toggleBtn.textContent = "raw"
  toggleBtn.title = "Toggle raw expression editing"

  let isRaw = false
  toggleBtn.addEventListener("click", () => {
    isRaw = !isRaw
    structuredView.style.display = isRaw ? "none" : ""
    rawView.style.display = isRaw ? "" : "none"
    toggleBtn.textContent = isRaw ? "visual" : "raw"
  })

  toggleRow.appendChild(toggleBtn)

  container.appendChild(structuredView)
  container.appendChild(rawView)
  container.appendChild(toggleRow)

  return container
}

/**
 * Create an editable field for a single string literal.
 *
 * @param lit — the literal metadata
 * @param isActive — true if this literal's value is in the rendered DOM output,
 *                    false if the condition was falsy, null if unknown
 * @param onChange — called when the input value changes
 */
function createLiteralField(
  lit: ExpressionLiteral,
  isActive: boolean | null,
  onChange: (newValue: string) => void,
): HTMLElement {
  const wrapper = document.createElement("span")
  wrapper.className = "expr-literal"
  if (isActive === true) wrapper.classList.add("expr-active")
  if (isActive === false) wrapper.classList.add("expr-inactive")
  wrapper.title = contextLabel(lit.context) +
    (isActive === true ? " (currently active)" : "") +
    (isActive === false ? " (currently inactive)" : "")

  // Context badge with active indicator
  const badge = document.createElement("span")
  badge.className = "expr-badge"
  if (isActive === true) badge.classList.add("expr-badge-active")
  if (isActive === false) badge.classList.add("expr-badge-inactive")
  const indicator = isActive === true ? "\u2713 " : isActive === false ? "\u25CB " : ""
  badge.textContent = indicator + shortContextLabel(lit.context)
  wrapper.appendChild(badge)

  // The editable input
  const input = document.createElement("input")
  input.className = "var-input expr-input"
  if (isActive === false) input.classList.add("expr-input-inactive")
  input.value = lit.value
  input.style.fontSize = "11px"

  // Auto-size the input to fit content
  const updateWidth = () => {
    const len = Math.max(input.value.length, 3)
    input.style.width = `${len + 1}ch`
  }
  updateWidth()

  input.addEventListener("input", updateWidth)
  input.addEventListener("change", () => onChange(input.value))

  wrapper.appendChild(input)

  return wrapper
}

/**
 * Human-readable label for the expression context.
 */
function contextLabel(context: string): string {
  switch (context) {
    case "ternary-consequent":
      return "Value when condition is true"
    case "ternary-alternate":
      return "Value when condition is false"
    case "conditional":
      return "Applied when condition is truthy"
    case "fallback":
      return "Fallback value"
    case "call-arg":
      return "Function argument"
    case "template-static":
      return "Static text in template"
    case "object-value":
      return "Object property value"
    case "array-item":
      return "Array item"
    default:
      return "Editable value"
  }
}

/**
 * Short badge label for the context.
 */
function shortContextLabel(context: string): string {
  switch (context) {
    case "ternary-consequent":
      return "if"
    case "ternary-alternate":
      return "else"
    case "conditional":
      return "when"
    case "fallback":
      return "or"
    case "call-arg":
      return "arg"
    case "template-static":
      return "text"
    case "object-value":
      return "val"
    case "array-item":
      return "item"
    default:
      return ""
  }
}
