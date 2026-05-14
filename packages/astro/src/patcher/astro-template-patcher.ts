/**
 * Astro template patcher — edits .astro source files using
 * position-based text surgery (like ts-morph for JSX).
 *
 * Uses @astrojs/compiler's parse() to find the exact AST node
 * at a given line/column, then does a surgical string replacement
 * on the raw source. We avoid serialize() round-tripping because
 * the Wasm compiler doesn't perfectly preserve all formatting.
 */
import { parse } from "@astrojs/compiler"
import { is } from "@astrojs/compiler/utils"
import type { AstroAttributePatch, AstroTextPatch } from "../types.js"

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
 * Apply text content patches to an .astro file.
 *
 * Uses whitespace-normalized search to find text in the template,
 * constrained to text node positions (between > and <).
 */
export async function patchText(
  source: string,
  patches: AstroTextPatch[],
  _fileName: string,
): Promise<string> {
  let result = source

  for (const patch of patches) {
    if (patch.source.lineNumber > 0) {
      // Position-based: find the line and do substring replacement
      const lines = result.split("\n")
      const lineIdx = patch.source.lineNumber - 1
      if (lineIdx >= 0 && lineIdx < lines.length) {
        const colIdx = Math.max(0, patch.source.columnNumber - 1)
        const foundIdx = lines[lineIdx].indexOf(patch.oldText, colIdx)
        if (foundIdx !== -1) {
          lines[lineIdx] =
            lines[lineIdx].slice(0, foundIdx) +
            patch.newText +
            lines[lineIdx].slice(foundIdx + patch.oldText.length)
          result = lines.join("\n")
          continue
        }
      }
    }

    // Fallback: whitespace-normalized search in template portion
    result = replaceTextInTemplate(result, patch.oldText, patch.newText)
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

/**
 * Replace text in the template portion of an .astro file,
 * using whitespace-normalized matching and text-node context validation.
 */
function replaceTextInTemplate(
  content: string,
  oldText: string,
  newText: string,
): string {
  const normalizedOld = oldText.replace(/\s+/g, " ").trim()
  if (!normalizedOld) return content

  // Find template region (after frontmatter, before <style>)
  let templateStart = 0
  const fmMatch = content.match(/^---\r?\n/)
  if (fmMatch) {
    const fmEnd = content.indexOf("\n---", fmMatch[0].length)
    if (fmEnd !== -1) templateStart = fmEnd + 4
  }

  const styleStart = content.indexOf("<style", templateStart)
  const templateEnd = styleStart !== -1 ? styleStart : content.length
  const template = content.slice(templateStart, templateEnd)

  // Build normalized version with position map
  const posMap: number[] = []
  let normalized = ""
  let inWhitespace = false

  for (let i = 0; i < template.length; i++) {
    if (/\s/.test(template[i])) {
      if (!inWhitespace && normalized.length > 0) {
        normalized += " "
        posMap.push(i)
        inWhitespace = true
      }
    } else {
      normalized += template[i]
      posMap.push(i)
      inWhitespace = false
    }
  }

  // Search for matches, skip attribute contexts
  let searchFrom = 0
  while (true) {
    const matchIdx = normalized.indexOf(normalizedOld, searchFrom)
    if (matchIdx === -1) {
      throw new Error(
        `Text not found in template: "${oldText.length > 60 ? oldText.slice(0, 60) + "..." : oldText}"`,
      )
    }

    const origStart = posMap[matchIdx]
    const matchEndNorm = matchIdx + normalizedOld.length - 1
    const origEnd =
      matchEndNorm < posMap.length ? posMap[matchEndNorm] + 1 : template.length

    // Verify text node context (between > and <)
    const before = template.slice(0, origStart)
    const lastGt = before.lastIndexOf(">")
    const lastLt = before.lastIndexOf("<")

    if (lastGt > lastLt) {
      const absStart = templateStart + origStart
      const absEnd = templateStart + origEnd
      return content.slice(0, absStart) + newText + content.slice(absEnd)
    }

    searchFrom = matchIdx + 1
  }
}
