import { replaceAtPosition } from "@editable-jsx/core"
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
 * Delegates to the shared TextPatcher from @editable-jsx/core for
 * position-based replacement with whitespace-normalized fallback.
 */
function applyTextPatches(
  content: string,
  patches: CSSPatch[],
): string {
  let result = content

  for (const patch of patches) {
    if (patch.action_type !== "updateTextContent") continue
    const { line, col, oldText, newText } = patch.textContent

    result = replaceAtPosition(result, line, col, oldText, newText, {
      textNodeOnly: true,
      skipFrontmatter: true,
      skipStyleBlocks: true,
    })
  }

  return result
}
