/**
 * Expression instrumentation — injects runtime metadata into
 * template expressions so the editor knows:
 *
 * 1. Which branch of a conditional was taken
 * 2. Whether a value came from a string literal or a variable
 * 3. The original expression structure for display
 *
 * Instead of guessing from the rendered output, the instrumented
 * expression records its decision path at render time.
 *
 * Example transform:
 *
 *   Before: class={active ? "on" : "off"}
 *   After:  class={__expr(active ? "on" : "off", {
 *     expr: 'active ? "on" : "off"',
 *     branches: [
 *       { value: "on", offset: 9, context: "ternary-consequent", active: active },
 *       { value: "off", offset: 16, context: "ternary-alternate", active: !active },
 *     ]
 *   })}
 *
 * The __expr function is a no-op at runtime (returns its first arg)
 * but attaches metadata to a global registry keyed by element+attribute.
 * The editor reads this registry instead of guessing.
 *
 * For variables (no string literals):
 *
 *   Before: href={url}
 *   After:  href={__expr(url, {
 *     expr: 'url',
 *     source: 'variable',
 *     variableName: 'url',
 *   })}
 *
 * The editor shows: "href = {url} → /about" (resolved value) with a
 * link to the variable definition.
 */

/**
 * Metadata attached to an instrumented expression.
 */
export interface ExpressionMetadata {
  /** The original expression source code */
  expr: string
  /** Whether this expression has editable string literals */
  hasLiterals: boolean
  /** For pure variable references */
  source?: "literal" | "variable" | "expression"
  /** Variable name if source === "variable" */
  variableName?: string
  /** Branch information for each string literal */
  branches?: ExpressionBranch[]
}

export interface ExpressionBranch {
  /** The string literal value */
  value: string
  /** Offset within the expression */
  offset: number
  /** Semantic context */
  context: string
  /** Whether this branch is currently active (evaluated at render time) */
  active: boolean
}

/**
 * Runtime expression registry — stores metadata for each
 * instrumented expression, keyed by element+attribute.
 *
 * The editor reads this to know:
 * - Which branches are active
 * - Whether a value is a literal or variable
 * - The original expression structure
 */
export const EXPR_REGISTRY_KEY = "__editableExpressions"

/**
 * The runtime helper injected into the page.
 * Returns the value unchanged but records metadata.
 *
 * Usage in instrumented template:
 *   class={__expr(active ? "on" : "off", metadata, elementId, "class")}
 */
export const RUNTIME_HELPER = `
;(function() {
  const registry = window.${EXPR_REGISTRY_KEY} = window.${EXPR_REGISTRY_KEY} || new Map();
  window.__expr = function(value, meta, elementKey, attrName) {
    if (meta) {
      const key = elementKey + ":" + attrName;
      registry.set(key, { ...meta, resolvedValue: value });
    }
    return value;
  };
})();
`

/**
 * Read expression metadata from the runtime registry.
 *
 * @param elementKey — unique key for the element (file:line:col)
 * @param attrName — attribute name (e.g., "class")
 * @returns metadata if the expression was instrumented, null otherwise
 */
export function readExpressionMetadata(
  elementKey: string,
  attrName: string,
): (ExpressionMetadata & { resolvedValue: unknown }) | null {
  const registry = (window as any)[EXPR_REGISTRY_KEY] as
    | Map<string, any>
    | undefined
  if (!registry) return null
  return registry.get(`${elementKey}:${attrName}`) ?? null
}

/**
 * Classify an expression: is it a pure variable, a pure literal,
 * or a complex expression with string literals?
 */
export function classifyExpression(expr: string): {
  source: "literal" | "variable" | "expression"
  variableName?: string
} {
  const trimmed = expr.trim()

  // Pure string literal: "value" or 'value'
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return { source: "literal" }
  }

  // Pure variable reference: identifier (no operators, no calls)
  if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(trimmed)) {
    return { source: "variable", variableName: trimmed }
  }

  // Member expression with optional chaining: props?.className
  if (/^[a-zA-Z_$][a-zA-Z0-9_$.?\[\]]*$/.test(trimmed)) {
    return { source: "variable", variableName: trimmed }
  }

  return { source: "expression" }
}
