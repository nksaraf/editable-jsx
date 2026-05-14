import type { CSSPatch, CSSPropertyPatch, CSSVariablePatch } from "../types.js"
import { extractStyleBlocks } from "../scanner/parse-astro.js"
import { applyCSSPropertyPatches, applyCSSVariablePatches } from "./css-patcher.js"

/**
 * Apply CSS patches to an .astro file.
 *
 * Strategy:
 * 1. Extract all <style> blocks
 * 2. For each patch, find the matching <style> block by charOffset
 * 3. Apply CSS patches to the block's CSS content
 * 4. Splice the modified CSS back into the .astro file
 *
 * We process blocks from last to first so that character offsets
 * remain valid as we splice.
 */
export function applyAstroPatches(
  content: string,
  patches: CSSPatch[],
  file: string,
): string {
  const blocks = extractStyleBlocks(content)
  if (blocks.length === 0) return content

  // Group patches by style block (matched by charOffset)
  const patchesByBlock = new Map<number, CSSPatch[]>()

  for (const patch of patches) {
    if (patch.action_type === "updateTextContent") {
      // Text content patches operate on the template, not <style> blocks
      continue
    }

    const offset = patch.styleBlockOffset

    // Find the closest matching block
    let bestBlock = blocks[0]
    for (const block of blocks) {
      if (block.charOffset === offset) {
        bestBlock = block
        break
      }
      // Fallback: if offset is within the block range, use it
      if (
        block.charOffset <= offset &&
        block.charOffset > bestBlock.charOffset
      ) {
        bestBlock = block
      }
    }

    if (!patchesByBlock.has(bestBlock.charOffset)) {
      patchesByBlock.set(bestBlock.charOffset, [])
    }
    patchesByBlock.get(bestBlock.charOffset)!.push(patch)
  }

  // Process blocks from last to first (preserve offsets)
  const sortedBlocks = [...blocks].sort(
    (a, b) => b.charOffset - a.charOffset,
  )

  let result = content

  for (const block of sortedBlocks) {
    const blockPatches = patchesByBlock.get(block.charOffset)
    if (!blockPatches || blockPatches.length === 0) continue

    const variablePatches = blockPatches.filter(
      (p): p is CSSVariablePatch => p.action_type === "updateCSSVariable",
    )
    const propertyPatches = blockPatches.filter(
      (p): p is CSSPropertyPatch => p.action_type === "updateCSSProperty",
    )

    let css = block.css

    if (variablePatches.length > 0) {
      css = applyCSSVariablePatches(css, variablePatches, file)
    }
    if (propertyPatches.length > 0) {
      css = applyCSSPropertyPatches(css, propertyPatches, file)
    }

    // Find the exact position of the CSS content in the file
    // The block.charOffset points to `<style...>`, we need to find where the CSS starts
    const styleTagEnd = result.indexOf(">", block.charOffset) + 1
    const closingStyleTag = result.indexOf("</style>", styleTagEnd)

    if (styleTagEnd > 0 && closingStyleTag > styleTagEnd) {
      result =
        result.slice(0, styleTagEnd) + css + result.slice(closingStyleTag)
    }
  }

  // Apply text content patches
  const textPatches = patches.filter(
    (p) => p.action_type === "updateTextContent",
  )
  if (textPatches.length > 0) {
    result = applyTextPatches(result, textPatches)
  }

  return result
}

/**
 * Apply text content patches to the template portion of an .astro file.
 *
 * Two strategies:
 * 1. If line/col are provided (> 0), find by position (precise)
 * 2. Otherwise, find by plain text search in the template portion
 *    (before any <style> or <script> blocks)
 */
function applyTextPatches(
  content: string,
  patches: CSSPatch[],
): string {
  let result = content

  for (const patch of patches) {
    if (patch.action_type !== "updateTextContent") continue
    const { line, col, oldText, newText } = patch.textContent

    if (line > 0) {
      // Strategy 1: position-based replacement
      const lines = result.split("\n")
      const lineIdx = line - 1
      let applied = false
      if (lineIdx >= 0 && lineIdx < lines.length) {
        const colIdx = Math.max(0, col - 1)
        const foundIdx = lines[lineIdx].indexOf(oldText, colIdx)
        if (foundIdx !== -1) {
          lines[lineIdx] =
            lines[lineIdx].slice(0, foundIdx) +
            newText +
            lines[lineIdx].slice(foundIdx + oldText.length)
          result = lines.join("\n")
          applied = true
        }
      }
      if (!applied) {
        // Fall back to whitespace-normalized search when position-based lookup misses
        result = replaceNormalizedText(result, oldText, newText)
      }
    } else {
      // Strategy 2: whitespace-normalized text search in template portion.
      // DOM textContent collapses whitespace across lines, but the source
      // may have the text split across multiple lines with indentation.
      // We search for the text by normalizing whitespace in both the source
      // and the search string, then map back to the original source range.
      result = replaceNormalizedText(result, oldText, newText)
    }
  }

  return result
}

/**
 * Find `oldText` in `content` using whitespace-normalized matching,
 * then replace the matched source range with `newText`.
 *
 * This handles the case where DOM textContent is a single line but
 * the source has the text split across multiple lines with indentation.
 */
function replaceNormalizedText(
  content: string,
  oldText: string,
  newText: string,
): string {
  // Normalize the search text: collapse whitespace to single spaces
  const normalizedOld = oldText.replace(/\s+/g, " ").trim()
  if (!normalizedOld) return content

  // Find the frontmatter end and first <style> to bound the template region
  let templateStart = 0
  const fmMatch = content.match(/^---\r?\n/)
  if (fmMatch) {
    const fmEnd = content.indexOf("\n---", fmMatch[0].length)
    if (fmEnd !== -1) templateStart = fmEnd + 4
  }

  const styleStart = content.indexOf("<style", templateStart)
  const templateEnd = styleStart !== -1 ? styleStart : content.length
  const template = content.slice(templateStart, templateEnd)

  // Build a normalized version of the template and a position map
  // that maps normalized positions back to original positions
  const posMap: number[] = [] // posMap[normalizedIdx] = originalIdx
  let normalized = ""
  let inWhitespace = false

  for (let i = 0; i < template.length; i++) {
    const ch = template[i]
    if (/\s/.test(ch)) {
      if (!inWhitespace && normalized.length > 0) {
        normalized += " "
        posMap.push(i)
        inWhitespace = true
      }
    } else {
      normalized += ch
      posMap.push(i)
      inWhitespace = false
    }
  }

  // Search for ALL matches of the normalized old text
  let searchFrom = 0
  while (true) {
    const matchIdx = normalized.indexOf(normalizedOld, searchFrom)
    if (matchIdx === -1) {
      console.warn(
        `[editable] replaceNormalizedText: could not find "${oldText}" in any text-node context`,
      )
      throw new Error(
        `Text not found in template: "${oldText.length > 60 ? oldText.slice(0, 60) + "..." : oldText}"`,
      )
    }

    // Map back to original positions
    const origStart = posMap[matchIdx]
    const matchEndNorm = matchIdx + normalizedOld.length - 1
    const origEnd =
      matchEndNorm < posMap.length
        ? posMap[matchEndNorm] + 1
        : template.length

    // Verify this match is in a text node context (between > and <),
    // not inside an HTML attribute value (between = and >)
    const before = template.slice(0, origStart)
    const lastGt = before.lastIndexOf(">")
    const lastLt = before.lastIndexOf("<")
    const lastEq = before.lastIndexOf("=")
    const lastQuote = Math.max(before.lastIndexOf('"'), before.lastIndexOf("'"))

    // If the last `>` comes after the last `<`, we're between tags = text node
    // If the last `<` comes after `>`, we're inside a tag = attribute context
    const isTextNode = lastGt > lastLt

    if (isTextNode) {
      // Replace in the original content
      const absStart = templateStart + origStart
      const absEnd = templateStart + origEnd
      return content.slice(0, absStart) + newText + content.slice(absEnd)
    }

    // Not a text node — try next match
    searchFrom = matchIdx + 1
  }
}
