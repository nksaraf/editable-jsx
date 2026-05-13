import postcss, { type Root } from "postcss"
import type { CSSVariable } from "../types.js"

/**
 * Parse CSS content and extract all custom property (--*) declarations.
 *
 * @param css      - Raw CSS string
 * @param file     - Absolute file path (for manifest)
 * @param offset   - Line offset for variables declared inside <style> blocks
 * @param styleBlockOffset - Character offset of the <style> block in the file
 * @param isGlobal - Whether this CSS is global (Astro `is:global`)
 */
export function parseCSSVariables(
  css: string,
  file: string,
  offset: number = 0,
  styleBlockOffset: number = 0,
  isGlobal: boolean = true,
): CSSVariable[] {
  let root: Root
  try {
    root = postcss.parse(css, { from: file })
  } catch {
    // Gracefully handle invalid CSS
    return []
  }

  const variables: CSSVariable[] = []

  root.walk((node) => {
    if (node.type !== "decl") return
    if (!node.prop.startsWith("--")) return

    // Determine scope: walk up to find the nearest rule or at-rule
    const scope = getScope(node)

    const line = (node.source?.start?.line ?? 1) + offset
    const col = node.source?.start?.column ?? 1

    variables.push({
      file,
      line,
      col,
      name: node.prop,
      value: node.value,
      rawValue: node.value,
      scope,
      isGlobal,
      styleBlockOffset,
    })
  })

  return variables
}

/**
 * Walk up the AST to build a scope string.
 * e.g. `:root`, `.dark`, `@media (max-width: 700px) :root`
 */
function getScope(node: postcss.Node): string {
  const parts: string[] = []
  let current = node.parent

  while (current && current.type !== "root") {
    if (current.type === "rule") {
      parts.unshift((current as postcss.Rule).selector)
    } else if (current.type === "atrule") {
      const atRule = current as postcss.AtRule
      parts.unshift(`@${atRule.name} ${atRule.params}`)
    }
    current = current.parent
  }

  return parts.join(" ") || ":root"
}
