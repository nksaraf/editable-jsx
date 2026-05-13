import postcss from "postcss"
import type { CSSVariablePatch, CSSPropertyPatch } from "../types.js"

/**
 * Apply CSS variable patches to a CSS string.
 * Uses PostCSS to parse, find matching declarations, and update values.
 */
export function applyCSSVariablePatches(
  css: string,
  patches: CSSVariablePatch[],
  file: string,
): string {
  const root = postcss.parse(css, { from: file })

  for (const patch of patches) {
    const { name, value, scope } = patch.variable
    let found = false

    root.walk((node) => {
      if (found) return
      if (node.type !== "decl") return
      if (node.prop !== name) return

      // Check that the scope matches
      const nodeScope = getScopeString(node)
      if (nodeScope === scope) {
        node.value = value
        found = true
      }
    })

    if (!found) {
      // Variable not found in this scope — try to add it
      // Find or create the matching rule
      let targetRule: postcss.Rule | postcss.Root | null = null

      if (scope === ":root") {
        root.walkRules(":root", (rule) => {
          targetRule = rule
        })
        if (!targetRule) {
          targetRule = postcss.rule({ selector: ":root" })
          root.prepend(targetRule)
        }
      }

      if (targetRule) {
        ;(targetRule as postcss.Container).append(
          postcss.decl({ prop: name, value }),
        )
      }
    }
  }

  return root.toString()
}

/**
 * Apply CSS property patches (non-variable properties like `background`, `color`, etc.)
 */
export function applyCSSPropertyPatches(
  css: string,
  patches: CSSPropertyPatch[],
  file: string,
): string {
  const root = postcss.parse(css, { from: file })

  for (const patch of patches) {
    const { selector, name, value } = patch.property
    let found = false

    root.walkRules(selector, (rule) => {
      if (found) return
      rule.walkDecls(name, (decl) => {
        decl.value = value
        found = true
      })
    })

    if (!found) {
      // Property not found — add to the matching rule
      root.walkRules(selector, (rule) => {
        if (found) return
        rule.append(postcss.decl({ prop: name, value }))
        found = true
      })
    }
  }

  return root.toString()
}

/**
 * Get the scope string for a CSS node by walking up the AST.
 */
function getScopeString(node: postcss.Node): string {
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
