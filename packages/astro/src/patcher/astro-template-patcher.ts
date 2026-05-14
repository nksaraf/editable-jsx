/**
 * Astro template patcher — edits .astro source files using
 * position-based text surgery (like ts-morph for JSX).
 *
 * Uses @astrojs/compiler's parse() to find the exact AST node
 * at a given line/column, then does a surgical string replacement
 * on the raw source. We avoid serialize() round-tripping because
 * the Wasm compiler doesn't perfectly preserve all formatting.
 */
import { replaceAtPosition } from "@editable-jsx/core"
import { parse } from "@astrojs/compiler"
import { is } from "@astrojs/compiler/utils"
import type { AstroAttributePatch, AstroExpressionPatch, AstroTextPatch } from "../types.js"
import { replaceStringLiteral } from "./expression-parser.js"

/**
 * Apply attribute patches to an .astro file.
 *
 * For each patch, finds the element at the given source position,
 * locates the attribute by name, and replaces its value in-place.
 */
export async function patchAttributes(
  source: string,
  patches: AstroAttributePatch[],
  fileName: string,
): Promise<string> {
  if (patches.length === 0) return source

  let result = source

  // Apply patches one at a time, re-parsing after each to keep offsets valid.
  // This is O(n * parse) but n is typically 1-3 patches per save.
  for (const patch of patches) {
    const { ast } = await parse(result, { position: true })
    const node = findNodeAt(ast, patch.source.lineNumber, patch.source.columnNumber)
    if (!node) {
      console.warn(
        `[editable-astro] No element found at ${fileName}:${patch.source.lineNumber}:${patch.source.columnNumber}`,
      )
      continue
    }

    // Find the attribute in the node
    const attr = node.attributes?.find((a: any) => a.name === patch.attribute)

    if (attr && attr.position?.start) {
      // Find the attribute value in the source by scanning from the attr name position.
      // Attr positions only have `start`, no reliable `end`.
      const nameStart = attr.position.start.offset
      const eqIdx = result.indexOf("=", nameStart)

      if (eqIdx !== -1 && eqIdx < nameStart + attr.name.length + 5) {
        // Skip whitespace after =
        let valueStart = eqIdx + 1
        while (valueStart < result.length && result[valueStart] === " ") valueStart++

        const delimiter = result[valueStart]

        if (delimiter === '"' || delimiter === "'") {
          // Quoted attribute: name="value"
          const closeQuote = result.indexOf(delimiter, valueStart + 1)
          if (closeQuote !== -1) {
            result =
              result.slice(0, valueStart) +
              `"${patch.value}"` +
              result.slice(closeQuote + 1)
          }
        } else if (delimiter === "{") {
          // Expression attribute: name={expr}
          const closeIdx = findMatchingBrace(result, valueStart)
          if (closeIdx !== -1) {
            const newVal = patch.value.includes("{")
              ? patch.value
              : `"${patch.value}"`
            result =
              result.slice(0, valueStart) +
              newVal +
              result.slice(closeIdx + 1)
          }
        }
      }
    } else if (!attr && node.position) {
      // Attribute doesn't exist — add it after the tag name
      const tagStart = node.position.start.offset
      // Find the tag name in result (starts with < then the name)
      const tagNameEnd = result.indexOf(node.name, tagStart) + node.name.length

      result =
        result.slice(0, tagNameEnd) +
        ` ${patch.attribute}="${patch.value}"` +
        result.slice(tagNameEnd)
    }
  }

  return result
}

/**
 * Apply expression patches — surgically replace individual string
 * literals inside expression attributes like class={active ? "on" : "off"}.
 *
 * Instead of destroying the expression, this finds the specific string
 * literal at the given offset and replaces just that string's content.
 */
export async function patchExpressions(
  source: string,
  patches: AstroExpressionPatch[],
  fileName: string,
): Promise<string> {
  if (patches.length === 0) return source

  let result = source

  for (const patch of patches) {
    const { ast } = await parse(result, { position: true })
    const node = findNodeAt(
      ast,
      patch.source.lineNumber,
      patch.source.columnNumber,
    )
    if (!node) {
      console.warn(
        `[editable-astro] No element found at ${fileName}:${patch.source.lineNumber}:${patch.source.columnNumber}`,
      )
      continue
    }

    const attr = node.attributes?.find((a: any) => a.name === patch.attribute)
    if (!attr?.position?.start) continue

    const nameStart = attr.position.start.offset
    const eqIdx = result.indexOf("=", nameStart)
    if (eqIdx === -1) continue

    let valueStart = eqIdx + 1
    while (valueStart < result.length && result[valueStart] === " ") valueStart++

    const delimiter = result[valueStart]

    if (delimiter === "{") {
      // Expression attribute — find the expression content
      const closeIdx = findMatchingBrace(result, valueStart)
      if (closeIdx === -1) continue

      // Extract the expression (between { and })
      const exprContent = result.slice(valueStart + 1, closeIdx)

      // Replace the specific string literal within the expression
      const modifiedExpr = replaceStringLiteral(
        exprContent,
        patch.literalOffset,
        patch.oldLiteral,
        patch.newLiteral,
      )

      result =
        result.slice(0, valueStart + 1) + modifiedExpr + result.slice(closeIdx)
    } else if (delimiter === '"' || delimiter === "'") {
      // Simple quoted attribute — the "expression" is just a string
      // Replace the content between quotes
      const closeQuote = result.indexOf(delimiter, valueStart + 1)
      if (closeQuote === -1) continue

      const currentValue = result.slice(valueStart + 1, closeQuote)
      if (currentValue === patch.oldLiteral) {
        result =
          result.slice(0, valueStart + 1) +
          patch.newLiteral +
          result.slice(closeQuote)
      }
    }
  }

  return result
}

/**
 * Apply text content patches to an .astro file.
 *
 * Delegates to the shared TextPatcher from @editable-jsx/core for
 * position-based replacement with whitespace-normalized fallback.
 */
export async function patchText(
  source: string,
  patches: AstroTextPatch[],
  _fileName: string,
): Promise<string> {
  let result = source

  for (const patch of patches) {
    result = replaceAtPosition(
      result,
      patch.source.lineNumber,
      patch.source.columnNumber,
      patch.oldText,
      patch.newText,
      {
        textNodeOnly: true,
        skipFrontmatter: true,
        skipStyleBlocks: true,
      },
    )
  }

  return result
}

/**
 * Find an AST node at a given line/column position.
 */
function findNodeAt(
  ast: any,
  line: number,
  col: number,
): any | null {
  let found: any = null

  walkDeep(ast, (node: any) => {
    if (!node.position?.start) return
    if (
      node.position.start.line === line &&
      node.position.start.column === col &&
      (is.element(node) || is.component(node) || is.customElement(node))
    ) {
      found = node
    }
  })

  return found
}

/**
 * Find the matching closing brace for an opening `{` at the given position.
 * Handles nested braces, template literals, and string literals.
 */
function findMatchingBrace(source: string, openPos: number): number {
  let depth = 0
  let inString: string | null = null

  for (let i = openPos; i < source.length; i++) {
    const ch = source[i]

    // Track string context to ignore braces inside strings
    if (inString) {
      if (ch === inString && source[i - 1] !== "\\") {
        inString = null
      }
      continue
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch
      continue
    }

    if (ch === "{") {
      depth++
    } else if (ch === "}") {
      depth--
      if (depth === 0) return i
    }
  }

  return -1 // No matching brace found
}

function walkDeep(node: any, callback: (node: any) => void): void {
  callback(node)
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkDeep(child, callback)
    }
  }
}

