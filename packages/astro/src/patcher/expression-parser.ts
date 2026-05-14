/**
 * Expression parser — extracts editable string literals from
 * JavaScript expressions found in Astro template attributes.
 *
 * Given `class={active ? "on" : "off"}`, this finds:
 * - { value: "on", offset: 16, context: "ternary-consequent" }
 * - { value: "off", offset: 23, context: "ternary-alternate" }
 *
 * Given `class={cn("base", active && "active")}`, this finds:
 * - { value: "base", offset: 4, context: "call-arg" }
 * - { value: "active", offset: 25, context: "call-arg" }
 *
 * The offset is relative to the opening `{` of the expression.
 * These offsets let the patcher surgically replace individual
 * string literals without destroying the expression structure.
 */

export interface ExpressionLiteral {
  /** The string value (without quotes) */
  value: string
  /** Character offset of the opening quote within the expression */
  offset: number
  /** What kind of quote: " or ' or ` */
  quote: string
  /** Semantic context for UI labeling */
  context: string
}

/**
 * Extract all string literals from a JavaScript expression.
 *
 * Scans the expression character by character, tracking string
 * boundaries. Does NOT fully parse JS — just finds quoted strings
 * and their positions. This is intentionally simple and robust.
 *
 * @param expr — the expression content (inside the braces, NOT including { })
 * @returns array of found string literals with their positions
 */
export function extractStringLiterals(expr: string): ExpressionLiteral[] {
  const literals: ExpressionLiteral[] = []
  let i = 0

  while (i < expr.length) {
    const ch = expr[i]

    if (ch === '"' || ch === "'") {
      // Found a string literal — scan to the closing quote
      const quote = ch
      const start = i
      i++ // skip opening quote

      let value = ""
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === "\\" && i + 1 < expr.length) {
          // Escaped character
          value += expr[i + 1]
          i += 2
        } else {
          value += expr[i]
          i++
        }
      }

      if (i < expr.length) {
        // Found closing quote
        const context = inferContext(expr, start)
        literals.push({ value, offset: start, quote, context })
        i++ // skip closing quote
      }
    } else if (ch === "`") {
      // Template literal — extract the static parts
      i++ // skip opening backtick
      const templateStart = i - 1
      let staticPart = ""
      let staticStart = i

      while (i < expr.length && expr[i] !== "`") {
        if (expr[i] === "$" && i + 1 < expr.length && expr[i + 1] === "{") {
          // Start of template expression — save the static part so far
          if (staticPart) {
            literals.push({
              value: staticPart,
              offset: staticStart,
              quote: "`",
              context: "template-static",
            })
          }
          // Skip the ${...} expression
          i += 2 // skip ${
          let depth = 1
          while (i < expr.length && depth > 0) {
            if (expr[i] === "{") depth++
            else if (expr[i] === "}") depth--
            i++
          }
          staticPart = ""
          staticStart = i
        } else if (expr[i] === "\\" && i + 1 < expr.length) {
          staticPart += expr[i + 1]
          i += 2
        } else {
          staticPart += expr[i]
          i++
        }
      }

      if (staticPart) {
        literals.push({
          value: staticPart,
          offset: staticStart,
          quote: "`",
          context: "template-static",
        })
      }

      if (i < expr.length) i++ // skip closing backtick
    } else if (ch === "/" && i + 1 < expr.length && expr[i + 1] === "/") {
      // Line comment — skip to end of line
      while (i < expr.length && expr[i] !== "\n") i++
    } else if (ch === "/" && i + 1 < expr.length && expr[i + 1] === "*") {
      // Block comment — skip to */
      i += 2
      while (i < expr.length - 1 && !(expr[i] === "*" && expr[i + 1] === "/")) i++
      i += 2
    } else {
      i++
    }
  }

  return literals
}

/**
 * Infer the semantic context of a string literal based on
 * surrounding characters in the expression.
 */
function inferContext(expr: string, pos: number): string {
  // Look backward for context clues
  const before = expr.slice(0, pos).trimEnd()

  if (before.endsWith("?")) return "ternary-consequent"
  if (before.endsWith(":")) return "ternary-alternate"
  if (before.endsWith("&&")) return "conditional"
  if (before.endsWith("||")) return "fallback"
  if (before.endsWith(",") || before.endsWith("(")) return "call-arg"
  if (before.endsWith("[")) return "array-item"
  if (before.endsWith(":") && before.includes("{")) return "object-value"

  return "value"
}

/**
 * Replace a specific string literal within an expression at a given offset.
 *
 * @param expr — the full expression (between { and })
 * @param offset — the offset of the string literal within expr
 * @param oldValue — the expected old value (for validation)
 * @param newValue — the new value to replace it with
 * @returns the modified expression
 */
/**
 * Replace a specific string literal within an expression.
 *
 * The offset from `extractStringLiterals` points to:
 * - The opening quote for regular strings ("..." or '...')
 * - The start of the static content for template literal parts
 *
 * @param expr — the full expression (between { and })
 * @param offset — the offset from extractStringLiterals
 * @param oldValue — the expected old value (for validation)
 * @param newValue — the new value to replace it with
 * @returns the modified expression
 */
export function replaceStringLiteral(
  expr: string,
  offset: number,
  oldValue: string,
  newValue: string,
): string {
  const ch = expr[offset]

  // Regular quoted string: offset points to the opening quote
  if (ch === '"' || ch === "'") {
    const closeQuote = expr.indexOf(ch, offset + 1)
    if (closeQuote === -1) {
      throw new Error(`Unclosed string literal at offset ${offset}`)
    }

    const currentValue = expr.slice(offset + 1, closeQuote)
    if (currentValue !== oldValue) {
      throw new Error(
        `Expected "${oldValue}" at offset ${offset}, found "${currentValue}"`,
      )
    }

    return expr.slice(0, offset + 1) + newValue + expr.slice(closeQuote)
  }

  // Template literal static part or content not at a quote:
  // Find the old value starting at/near the offset and replace it
  const searchStart = Math.max(0, offset - 1)
  const idx = expr.indexOf(oldValue, searchStart)
  if (idx === -1 || idx > offset + 2) {
    throw new Error(
      `String literal "${oldValue}" not found near offset ${offset}`,
    )
  }

  return expr.slice(0, idx) + newValue + expr.slice(idx + oldValue.length)
}
