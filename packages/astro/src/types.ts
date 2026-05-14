import type { BasePatch, SourceLocation } from "@editable-jsx/core"

/**
 * Source annotation injected on every element at build time.
 * Read from DOM at runtime for click-to-source mapping.
 */
export interface AstroSourceAnnotation extends SourceLocation {
  /** HTML tag name or Astro component name */
  elementName: string
  /** Parent Astro component file (for component tree) */
  componentName: string | null
}

/**
 * Patch for editing an Astro template attribute.
 *
 * For quoted attributes (class="value"), replaces the whole value.
 * For expression attributes (class={expr}), use AstroExpressionPatch instead.
 */
export interface AstroAttributePatch extends BasePatch {
  action_type: "updateAstroAttribute"
  source: { lineNumber: number; columnNumber: number }
  attribute: string
  value: string
}

/**
 * Patch for editing a specific string literal INSIDE an expression attribute.
 *
 * Instead of replacing class={active ? "on" : "off"} entirely, this
 * replaces just "on" → "active" while preserving the ternary structure.
 *
 * The `literalOffset` is the character offset of the string literal
 * within the expression (relative to the opening {).
 */
export interface AstroExpressionPatch extends BasePatch {
  action_type: "updateAstroExpression"
  source: { lineNumber: number; columnNumber: number }
  attribute: string
  /** The original string literal value (without quotes) */
  oldLiteral: string
  /** The new string literal value */
  newLiteral: string
  /** Character offset of the string literal within the expression */
  literalOffset: number
}

/**
 * Patch for editing text content in an Astro template.
 */
export interface AstroTextPatch extends BasePatch {
  action_type: "updateAstroText"
  source: { lineNumber: number; columnNumber: number }
  oldText: string
  newText: string
}

export type AstroPatch = AstroAttributePatch | AstroExpressionPatch | AstroTextPatch

export interface AstroEditorOptions {
  /** Enable template attribute editing (default: true) */
  templateEditing?: boolean
  /** Enable CSS editing via @editable-jsx/css (default: true) */
  cssEditing?: boolean
  /** Keyboard shortcut for editor toggle (default: "meta+shift+e") */
  shortcut?: string
  /** Files to exclude from annotation */
  exclude?: RegExp[]
}

/**
 * DOM data attribute names injected by the annotation transform.
 */
export const ATTRS = {
  sourceFile: "data-editable-file",
  line: "data-editable-line",
  col: "data-editable-col",
  element: "data-editable-element",
  component: "data-editable-component",
} as const
