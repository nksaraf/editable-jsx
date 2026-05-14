/**
 * Expression Field — renders an interactive UI for editing string
 * literals inside JavaScript expressions.
 *
 * Given class={active ? "on" : "off"}, renders:
 *
 *   ┌──────────────────────────────────────────┐
 *   │ active ?  [on_____]  :  [off____]        │
 *   │           editable      editable         │
 *   │                              [raw] toggle│
 *   └──────────────────────────────────────────┘
 *
 * The logic (ternary operator, function calls, conditionals) is shown
 * as read-only labels. The string literals are editable input fields.
 * A "raw" toggle shows the full expression as a textarea.
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
 * Create an interactive expression editor.
 *
 * @param expression — the raw expression string (between { and })
 * @param literals — the editable string literals extracted from the expression
 * @param onChange — called when any literal is edited
 * @returns the DOM element for the editor
 */
export function createExpressionField(
  expression: string,
  literals: ExpressionLiteral[],
  onChange: (changes: ExpressionChange[]) => void,
): HTMLElement {
  const container = document.createElement("div")
  container.className = "expr-field"

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

      // Editable field for the string literal
      const field = createLiteralField(lit, (newValue) => {
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

    if (!isRaw) {
      // Sync raw edits back — the textarea may have been modified
      // but we can't parse it back into structured form reliably,
      // so we just keep the structured changes
    }
  })

  toggleRow.appendChild(toggleBtn)

  container.appendChild(structuredView)
  container.appendChild(rawView)
  container.appendChild(toggleRow)

  return container
}

/**
 * Create an editable field for a single string literal.
 */
function createLiteralField(
  lit: ExpressionLiteral,
  onChange: (newValue: string) => void,
): HTMLElement {
  const wrapper = document.createElement("span")
  wrapper.className = "expr-literal"
  wrapper.title = contextLabel(lit.context)

  // Context badge (small label showing what this string is)
  const badge = document.createElement("span")
  badge.className = "expr-badge"
  badge.textContent = shortContextLabel(lit.context)
  wrapper.appendChild(badge)

  // The editable input
  const input = document.createElement("input")
  input.className = "var-input expr-input"
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
