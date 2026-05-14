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
 */
export interface AstroAttributePatch extends BasePatch {
  action_type: "updateAstroAttribute"
  source: { lineNumber: number; columnNumber: number }
  attribute: string
  value: string
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

export type AstroPatch = AstroAttributePatch | AstroTextPatch

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
