import type { CSSVariable } from "../types.js"
import { parseCSSVariables } from "./parse-css.js"

/**
 * Result of extracting a <style> block from an .astro file.
 */
export interface StyleBlock {
  /** The CSS content between the <style> tags */
  css: string
  /** Character offset of the opening <style> tag in the file */
  charOffset: number
  /** Line offset — how many lines before the CSS content starts */
  lineOffset: number
  /** Whether this block has `is:global` */
  isGlobal: boolean
}

/**
 * Extract all <style> blocks from an .astro file.
 *
 * Handles:
 * - `<style>`           — scoped (Astro default)
 * - `<style is:global>`  — global
 * - `<style lang="css">` — with lang attribute
 * - Multiple style blocks in one file
 */
export function extractStyleBlocks(content: string): StyleBlock[] {
  const blocks: StyleBlock[] = []

  // Skip frontmatter (--- ... ---) to avoid matching <style> in JS strings/comments
  let searchStart = 0
  const fmMatch = content.match(/^---\r?\n/)
  if (fmMatch) {
    const fmEnd = content.indexOf("\n---", fmMatch[0].length)
    if (fmEnd !== -1) {
      searchStart = fmEnd + 4 // past the closing ---
    }
  }

  // Also skip HTML comments that might contain <style>
  const searchContent = content.slice(searchStart)

  // Match <style ...> ... </style> — non-greedy, handles attributes
  const styleRegex = /<style(\s[^>]*)?>([^]*?)<\/style>/gi
  let match: RegExpExecArray | null

  while ((match = styleRegex.exec(searchContent)) !== null) {
    // Adjust charOffset to account for the skipped frontmatter
    match.index += searchStart
    const attrs = match[1] || ""
    const css = match[2]
    const charOffset = match.index
    const isGlobal = /\bis:global\b/.test(attrs)

    // Count newlines before the CSS content starts (after <style...>)
    const beforeStyle = content.slice(0, match.index + match[0].indexOf(css))
    const lineOffset = beforeStyle.split("\n").length - 1

    blocks.push({
      css,
      charOffset,
      lineOffset,
      isGlobal,
    })
  }

  // Filter out any blocks whose charOffset falls inside an HTML comment (<!-- ... -->)
  const commentRanges: Array<[number, number]> = []
  const commentRegex = /<!--[\s\S]*?-->/g
  let cm: RegExpExecArray | null
  while ((cm = commentRegex.exec(content)) !== null) {
    commentRanges.push([cm.index, cm.index + cm[0].length])
  }

  if (commentRanges.length > 0) {
    return blocks.filter((block) => {
      return !commentRanges.some(
        ([start, end]) => block.charOffset >= start && block.charOffset < end,
      )
    })
  }

  return blocks
}

/**
 * Parse an .astro file and extract all CSS variables from its <style> blocks.
 */
export function parseAstroVariables(
  content: string,
  file: string,
): CSSVariable[] {
  const blocks = extractStyleBlocks(content)
  const variables: CSSVariable[] = []

  for (const block of blocks) {
    const blockVars = parseCSSVariables(
      block.css,
      file,
      block.lineOffset,
      block.charOffset,
      block.isGlobal,
    )
    variables.push(...blockVars)
  }

  return variables
}
