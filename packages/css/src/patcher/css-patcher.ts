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
 *
 * Selector matching is flexible:
 * - Exact match first (walkRules)
 * - If not found, tries normalized comparison (collapse whitespace, strip Astro scoping)
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

    // Try exact match first
    root.walkRules(selector, (rule) => {
      if (found) return
      rule.walkDecls(name, (decl) => {
        decl.value = value
        found = true
      })
    })

    // Fallback: normalized selector comparison
    if (!found) {
      const normalizedTarget = normalizeSelector(selector)
      root.walkRules((rule) => {
        if (found) return
        if (normalizeSelector(rule.selector) === normalizedTarget) {
          rule.walkDecls(name, (decl) => {
            decl.value = value
            found = true
          })
          if (!found) {
            // Property doesn't exist in this rule — add it
            rule.append(postcss.decl({ prop: name, value }))
            found = true
          }
        }
      })
    }
  }

  return root.toString()
}

/**
 * Normalize a CSS selector for comparison.
 * Collapses whitespace and strips Astro scoping attributes.
 */
function normalizeSelector(selector: string): string {
  return selector
    .replace(/\[data-astro-cid-[a-z0-9]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
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
