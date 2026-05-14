/**
 * TextPatcher — surgical string replacement in source files.
 *
 * This is the "dumb" layer: it finds text in a source string and
 * replaces it. It does NOT parse any AST — it works on raw strings.
 *
 * Three replacement strategies:
 * 1. Position-based: find text at exact line:col
 * 2. Normalized: collapse whitespace, search with position map
 * 3. Literal: find exact string at a character offset
 *
 * The "smart" layer (ASTPatcher) finds WHERE to replace using
 * framework-specific AST parsing. TextPatcher does the actual splice.
 */

export interface ReplaceOptions {
  /** If true, only match text between > and < (text node context) */
  textNodeOnly?: boolean
  /** Skip the frontmatter region (--- ... ---) */
  skipFrontmatter?: boolean
  /** Skip content inside <style> blocks */
  skipStyleBlocks?: boolean
}

/**
 * Replace text at an exact character offset in a source string.
 * Used for expression literal replacement and AST-guided edits.
 */
export function replaceAtOffset(
  source: string,
  offset: number,
  oldText: string,
  newText: string,
): string {
  const actual = source.slice(offset, offset + oldText.length)
  if (actual !== oldText) {
    throw new Error(
      `Text mismatch at offset ${offset}: expected "${oldText.slice(0, 30)}", found "${actual.slice(0, 30)}"`,
    )
  }
  return source.slice(0, offset) + newText + source.slice(offset + oldText.length)
}

/**
 * Replace text at a specific line and column (1-based).
 * Falls back to normalized search if not found at the exact position.
 */
export function replaceAtPosition(
  source: string,
  line: number,
  col: number,
  oldText: string,
  newText: string,
  options: ReplaceOptions = {},
): string {
  if (line > 0) {
    const lines = source.split("\n")
    const lineIdx = line - 1
    if (lineIdx >= 0 && lineIdx < lines.length) {
      const colIdx = Math.max(0, col - 1)
      const foundIdx = lines[lineIdx].indexOf(oldText, colIdx)
      if (foundIdx !== -1) {
        lines[lineIdx] =
          lines[lineIdx].slice(0, foundIdx) +
          newText +
          lines[lineIdx].slice(foundIdx + oldText.length)
        return lines.join("\n")
      }
    }
    // Position-based failed — fall through to normalized search
  }

  return replaceNormalized(source, oldText, newText, options)
}

/**
 * Replace text using whitespace-normalized matching.
 *
 * DOM textContent collapses whitespace across lines, but the source
 * may have the text split across multiple lines with indentation.
 * This normalizes both sides and maps positions back to the original.
 *
 * Optionally validates that the match is in text-node context
 * (between > and <, not inside an attribute value).
 */
export function replaceNormalized(
  source: string,
  oldText: string,
  newText: string,
  options: ReplaceOptions = {},
): string {
  const normalizedOld = oldText.replace(/\s+/g, " ").trim()
  if (!normalizedOld) {
    throw new Error("Cannot search for empty/whitespace-only text")
  }

  // Determine the search region
  let regionStart = 0
  let regionEnd = source.length

  if (options.skipFrontmatter) {
    const fmMatch = source.match(/^---\r?\n/)
    if (fmMatch) {
      const fmEnd = source.indexOf("\n---", fmMatch[0].length)
      if (fmEnd !== -1) regionStart = fmEnd + 4
    }
  }

  if (options.skipStyleBlocks) {
    const styleStart = source.indexOf("<style", regionStart)
    if (styleStart !== -1) regionEnd = styleStart
  }

  const region = source.slice(regionStart, regionEnd)

  // Build normalized version with position map
  const posMap: number[] = []
  let normalized = ""
  let inWhitespace = false

  for (let i = 0; i < region.length; i++) {
    if (/\s/.test(region[i])) {
      if (!inWhitespace && normalized.length > 0) {
        normalized += " "
        posMap.push(i)
        inWhitespace = true
      }
    } else {
      normalized += region[i]
      posMap.push(i)
      inWhitespace = false
    }
  }

  // Search for matches
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
      matchEndNorm < posMap.length ? posMap[matchEndNorm] + 1 : region.length

    // Optionally validate text-node context (between > and <)
    if (options.textNodeOnly) {
      const before = region.slice(0, origStart)
      const lastGt = before.lastIndexOf(">")
      const lastLt = before.lastIndexOf("<")

      if (lastGt <= lastLt) {
        // Inside a tag (attribute context) — skip this match
        searchFrom = matchIdx + 1
        continue
      }
    }

    // Replace in the original source
    const absStart = regionStart + origStart
    const absEnd = regionStart + origEnd
    return source.slice(0, absStart) + newText + source.slice(absEnd)
  }
}
