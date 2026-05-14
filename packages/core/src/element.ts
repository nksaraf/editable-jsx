/**
 * Unified element model for editable-jsx.
 *
 * Every framework (React, Astro, raw HTML) produces ElementNodes
 * through a FrameworkAdapter. The editor UI consumes ElementNodes
 * without knowing which framework produced them.
 *
 * Key invariant: every editable element has a SourceLocation that
 * anchors it to a position in a source file. This is what makes
 * save-to-source work across all frameworks.
 */

import type { BasePatch, SourceLocation } from "./types.js"

// ── Editable Property ───────────────────────────────────────────────

/**
 * A single editable property on an element.
 * The `kind` discriminant determines which patcher handles saves.
 */
export type EditableProperty =
  | EditableProp
  | EditableCSSProperty
  | EditableCSSVariable
  | EditableText
  | EditableAttribute
  | EditableClassNamePart

/** Component prop (React) */
export interface EditableProp {
  kind: "prop"
  name: string
  value: unknown
  serializable: boolean
  source: SourceLocation
}

/** CSS property on a matched rule */
export interface EditableCSSProperty {
  kind: "css-property"
  name: string
  value: string
  selector: string
  sourceFile: string
  overridden: boolean
}

/** CSS custom property (variable) */
export interface EditableCSSVariable {
  kind: "css-variable"
  name: string
  value: string
  resolvedValue: string
  scope: string
  sourceFile: string
}

/** Text content of an element */
export interface EditableText {
  kind: "text"
  value: string
  source: SourceLocation
}

/** HTML/Astro template attribute */
export interface EditableAttribute {
  kind: "attribute"
  name: string
  value: string
  source: SourceLocation
}

/** A single string literal inside a className expression (React) */
export interface EditableClassNamePart {
  kind: "classname-part"
  value: string
  partSource: SourceLocation
  parentSource: SourceLocation
  type: "static" | "conditional" | "fallback" | "template"
}

// ── Element Node ────────────────────────────────────────────────────

/**
 * Universal representation of one editable element.
 * Produced by a FrameworkAdapter from framework-specific data.
 */
export interface ElementNode {
  /** Stable identifier within the editor session */
  id: string

  /** Human-readable label (tag name, component name) */
  displayName: string

  /** Raw HTML tag or component name */
  elementName: string

  /** Source location of the opening tag */
  source: SourceLocation

  /** Which file this element lives in */
  sourceFile: string

  /** Parent component name (null for plain HTML elements) */
  componentName: string | null

  /** Framework that produced this node */
  framework: "react" | "astro" | "css" | "html"

  /** All editable properties */
  properties: EditableProperty[]

  /** Tree relationships */
  parentId: string | null
  childIds: string[]

  /** Whether this node has unsaved changes */
  dirty: boolean

  /** The live DOM node (null for server-only representations) */
  domNode: Element | null
}

// ── Property Change ─────────────────────────────────────────────────

/** A pending edit — what the user changed but hasn't saved yet. */
export interface PropertyChange {
  property: EditableProperty
  newValue: unknown
}

// ── Component Tree ──────────────────────────────────────────────────

/**
 * Flat registry of ElementNodes with parent/child lookup.
 */
export class ComponentTree {
  nodes: Map<string, ElementNode> = new Map()

  roots(): ElementNode[] {
    const result: ElementNode[] = []
    for (const node of this.nodes.values()) {
      if (node.parentId === null) result.push(node)
    }
    return result
  }

  upsert(node: ElementNode): void {
    this.nodes.set(node.id, node)

    // Update parent's childIds
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId)
      if (parent && !parent.childIds.includes(node.id)) {
        parent.childIds.push(node.id)
      }
    }
  }

  remove(id: string): void {
    const node = this.nodes.get(id)
    if (!node) return

    // Remove from parent's childIds
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId)
      if (parent) {
        parent.childIds = parent.childIds.filter((cid) => cid !== id)
      }
    }

    this.nodes.delete(id)
  }

  walk(visitor: (node: ElementNode, depth: number) => void): void {
    const visit = (node: ElementNode, depth: number) => {
      visitor(node, depth)
      for (const childId of node.childIds) {
        const child = this.nodes.get(childId)
        if (child) visit(child, depth + 1)
      }
    }
    for (const root of this.roots()) {
      visit(root, 0)
    }
  }

  get(id: string): ElementNode | undefined {
    return this.nodes.get(id)
  }

  clear(): void {
    this.nodes.clear()
  }
}

// ── Framework Adapter ───────────────────────────────────────────────

/**
 * Each framework implements this interface to bridge its native
 * element representation into the unified ElementNode model.
 *
 * The adapter is the ONLY place where framework-specific knowledge lives.
 * The editor UI, component tree, and save orchestration are all
 * framework-agnostic — they work with ElementNodes and PropertyChanges.
 */
export interface FrameworkAdapter<NativeElement = unknown, NativePatch extends BasePatch = BasePatch> {
  /** Framework identifier */
  readonly framework: ElementNode["framework"]

  /** Convert a native element to the universal ElementNode. */
  toElementNode(native: NativeElement): ElementNode

  /** Convert pending property changes to framework-specific patches. */
  toPatches(node: ElementNode, changes: PropertyChange[]): NativePatch[]

  /** Apply framework-specific patches to source files (server-side). */
  applyPatches(patches: NativePatch[]): Promise<void>

  /** Live preview a property change in the browser (optional). */
  preview?(node: ElementNode, change: PropertyChange): void

  /** Revert a live preview (optional). */
  revertPreview?(node: ElementNode, change: PropertyChange): void
}
