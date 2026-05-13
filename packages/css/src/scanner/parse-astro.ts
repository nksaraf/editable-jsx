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

  // Match <style ...> ... </style> — non-greedy, handles attributes
  const styleRegex = /<style(\s[^>]*)?>([^]*?)<\/style>/gi
  let match: RegExpExecArray | null

  while ((match = styleRegex.exec(content)) !== null) {
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
