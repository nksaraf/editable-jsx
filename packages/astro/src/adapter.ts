/**
 * AstroAdapter — bridges Astro DOM elements into the unified ElementNode model.
 *
 * Reads data-editable-* attributes (injected at build time by the annotation
 * transform) and CSS rules (via the CSS inspector) to produce ElementNodes
 * with full editable properties.
 *
 * This is the Astro implementation of the FrameworkAdapter interface.
 */

import type {
  EditableAttribute,
  EditableCSSProperty,
  EditableCSSVariable,
  EditableProperty,
  EditableText,
  ElementNode,
  FrameworkAdapter,
  PropertyChange,
} from "@editable-jsx/core"
import { sourceResolver } from "@editable-jsx/core"

import type { AstroPatch, AstroAttributePatch, AstroTextPatch } from "./types.js"
import { ATTRS } from "./types.js"

// ── Reading source annotations from DOM ─────────────────────────────

/**
 * Read the editable-jsx source annotation from a DOM element.
 * Returns null if the element has no annotation.
 *
 * Delegates source file/position resolution to the shared SourceResolver
 * from @editable-jsx/core, then reads element/component names from
 * data-editable-* attributes.
 */
export function readSourceAnnotation(el: Element): {
  file: string
  line: number
  col: number
  element: string
  component: string | null
} | null {
  const resolved = sourceResolver.resolve(el)
  if (!resolved) return null

  return {
    file: resolved.fileName,
    line: resolved.lineNumber,
    col: resolved.columnNumber,
    element: el.getAttribute(ATTRS.element) || el.tagName.toLowerCase(),
    component: el.getAttribute(ATTRS.component),
  }
}

// ── Building ElementNodes from DOM ──────────────────────────────────

/**
 * Create an ElementNode from a DOM element.
 * Reads source annotations + HTML attributes + text content + CSS rules.
 */
export function elementFromDOM(el: Element): ElementNode | null {
  const source = readSourceAnnotation(el)
  if (!source) return null

  const id = `${source.file}:${source.line}:${source.col}`
  const properties: EditableProperty[] = []

  // ── HTML attributes (editable) ──────────────────────
  for (const attr of el.attributes) {
    // Skip our injected metadata attributes and Astro internals
    if (
      attr.name.startsWith("data-editable-") ||
      attr.name.startsWith("data-astro-") ||
      attr.name === "style" // handled separately via CSS
    ) {
      continue
    }

    properties.push({
      kind: "attribute",
      name: attr.name,
      value: attr.value,
      source: {
        fileName: source.file,
        lineNumber: source.line,
        columnNumber: source.col,
      },
    } satisfies EditableAttribute)
  }

  // ── Text content ────────────────────────────────────
  const directText = getDirectTextContent(el).trim()
  if (directText) {
    properties.push({
      kind: "text",
      value: directText,
      source: {
        fileName: source.file,
        lineNumber: source.line,
        columnNumber: source.col,
      },
    } satisfies EditableText)
  }

  // ── CSS properties (from matched rules) ─────────────
  // Defer CSS property extraction to the editor — it requires CSSOM
  // which is expensive to compute for every element during tree building.

  return {
    id,
    displayName: source.component || source.element,
    elementName: source.element,
    source: {
      fileName: source.file,
      lineNumber: source.line,
      columnNumber: source.col,
    },
    sourceFile: source.file,
    componentName: source.component,
    framework: "astro",
    properties,
    parentId: null, // filled in by tree builder
    childIds: [],
    dirty: false,
    domNode: el,
  }
}

// ── Building the component tree from DOM ────────────────────────────

/**
 * Scan the entire DOM and build a tree of ElementNodes.
 *
 * Tries multiple strategies to find elements with source info:
 * 1. data-editable-file annotations (from our annotation transform)
 * 2. data-astro-source-file (from Astro's devToolbar)
 * 3. data-astro-cid-* (Astro scoped styling — always present)
 */
export function buildTreeFromDOM(): ElementNode[] {
  const nodes: ElementNode[] = []
  const seen = new Set<Element>()

  // Strategy 1: Our own annotations
  for (const el of document.querySelectorAll(`[${ATTRS.sourceFile}]`)) {
    if (seen.has(el)) continue
    seen.add(el)
    const node = elementFromDOM(el)
    if (node) nodes.push(node)
  }

  // Strategy 2: Astro's native annotations
  for (const el of document.querySelectorAll("[data-astro-source-file]")) {
    if (seen.has(el)) continue
    seen.add(el)
    const node = elementFromDOM(el)
    if (node) nodes.push(node)
  }

  // Strategy 3: Elements with Astro CID (always present in Astro dev)
  // Only use visual elements (skip script, style, etc.)
  if (nodes.length === 0) {
    const visualTags = new Set([
      "div", "section", "main", "header", "footer", "nav", "article",
      "aside", "h1", "h2", "h3", "h4", "h5", "h6", "p", "span",
      "a", "button", "ul", "ol", "li", "img", "figure", "figcaption",
      "form", "input", "textarea", "select", "label", "table",
    ])

    for (const el of document.querySelectorAll("*")) {
      if (seen.has(el)) continue
      if (!visualTags.has(el.tagName.toLowerCase())) continue
      // Must have an Astro CID or be inside one
      let hasCid = false
      for (const attr of el.attributes) {
        if (attr.name.startsWith("data-astro-cid-")) {
          hasCid = true
          break
        }
      }
      if (!hasCid) continue

      seen.add(el)
      const node = elementFromDOM(el)
      if (node) nodes.push(node)
    }
  }

  // Build parent-child relationships by walking the DOM
  const nodeMap = new Map<Element, ElementNode>()
  for (const node of nodes) {
    if (node.domNode) nodeMap.set(node.domNode, node)
  }

  for (const node of nodes) {
    if (!node.domNode) continue
    // Walk up to find the nearest annotated ancestor
    let parent = node.domNode.parentElement
    while (parent) {
      const parentNode = nodeMap.get(parent)
      if (parentNode) {
        node.parentId = parentNode.id
        if (!parentNode.childIds.includes(node.id)) {
          parentNode.childIds.push(node.id)
        }
        break
      }
      parent = parent.parentElement
    }
  }

  return nodes
}

// ── AstroAdapter ────────────────────────────────────────────────────

export const AstroAdapter: FrameworkAdapter<Element, AstroPatch> = {
  framework: "astro",

  toElementNode(el: Element): ElementNode {
    const node = elementFromDOM(el)
    if (!node) {
      throw new Error(
        `Element has no source annotation: <${el.tagName.toLowerCase()}>`,
      )
    }
    return node
  },

  toPatches(node: ElementNode, changes: PropertyChange[]): AstroPatch[] {
    const patches: AstroPatch[] = []

    for (const change of changes) {
      const { property, newValue } = change

      if (property.kind === "attribute") {
        patches.push({
          action_type: "updateAstroAttribute",
          file: node.sourceFile,
          source: {
            lineNumber: node.source.lineNumber,
            columnNumber: node.source.columnNumber,
          },
          attribute: property.name,
          value: String(newValue),
        } satisfies AstroAttributePatch)
      }

      if (property.kind === "text") {
        patches.push({
          action_type: "updateAstroText",
          file: node.sourceFile,
          source: {
            lineNumber: property.source.lineNumber,
            columnNumber: property.source.columnNumber,
          },
          oldText: property.value,
          newText: String(newValue),
        } satisfies AstroTextPatch)
      }
    }

    return patches
  },

  async applyPatches(patches: AstroPatch[]): Promise<void> {
    // Client-side: send to server via HMR
    const client = (window as any).__astroEditorClient
    if (client) {
      await client.save(patches)
    }
  },

  preview(node: ElementNode, change: PropertyChange): void {
    if (!node.domNode) return
    const el = node.domNode as HTMLElement

    if (change.property.kind === "text") {
      // Update text content directly
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          child.textContent = String(change.newValue)
          return
        }
      }
    }

    if (change.property.kind === "attribute") {
      el.setAttribute(change.property.name, String(change.newValue))
    }
  },

  revertPreview(node: ElementNode, change: PropertyChange): void {
    if (!node.domNode) return
    const el = node.domNode as HTMLElement

    if (change.property.kind === "text") {
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          child.textContent = change.property.value
          return
        }
      }
    }

    if (change.property.kind === "attribute") {
      el.setAttribute(change.property.name, change.property.value)
    }
  },
}

// ── Helpers ─────────────────────────────────────────────────────────

function getDirectTextContent(el: Element): string {
  let text = ""
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ""
    }
  }
  return text
}
