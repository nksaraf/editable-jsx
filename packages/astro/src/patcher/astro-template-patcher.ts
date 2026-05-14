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

  const { ast } = await parse(source, { position: true })
  let result = source

  // Sort patches by position descending so offsets stay valid
  const sorted = [...patches].sort((a, b) => {
    const lineDiff = b.source.lineNumber - a.source.lineNumber
    return lineDiff !== 0 ? lineDiff : b.source.columnNumber - a.source.columnNumber
  })

  for (const patch of sorted) {
    // Find the element at this position
    const node = findNodeAt(ast, patch.source.lineNumber, patch.source.columnNumber)
    if (!node) {
      console.warn(
        `[editable-astro] No element found at ${fileName}:${patch.source.lineNumber}:${patch.source.columnNumber}`,
      )
      continue
    }

    // Find the attribute in the node
    const attr = node.attributes?.find((a: any) => a.name === patch.attribute)

    if (attr && attr.position) {
      // Replace the attribute value in the raw source
      const attrStart = attr.position.start.offset
      const attrEnd = attr.position.end?.offset ?? attrStart

      // The attribute in source looks like: name="value" or name={expr}
      // We need to find the value portion and replace it
      const attrSource = source.slice(attrStart, attrEnd)
      const eqIdx = attrSource.indexOf("=")

      if (eqIdx !== -1) {
        // Has a value — replace everything after =
        const valueStart = attrStart + eqIdx + 1
        // Find the quote or brace
        const quoteChar = source[valueStart]
        const isQuoted = quoteChar === '"' || quoteChar === "'"

        if (isQuoted) {
          const closeQuote = source.indexOf(quoteChar, valueStart + 1)
          if (closeQuote !== -1) {
            result =
              result.slice(0, valueStart + 1) +
              patch.value +
              result.slice(closeQuote)
          }
        }
      }
    } else if (!attr && node.position) {
      // Attribute doesn't exist — add it after the tag name
      // Find the position right after the tag name
      const tagStart = node.position.start.offset
      const tagSource = source.slice(tagStart)
      const tagNameEnd = tagSource.indexOf(node.name) + node.name.length + tagStart
      const insertPos = tagNameEnd

      result =
        result.slice(0, insertPos) +
        ` ${patch.attribute}="${patch.value}"` +
        result.slice(insertPos)
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
    if (matchIdx === -1) return content

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
