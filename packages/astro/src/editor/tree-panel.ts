/**
 * Component Tree Panel — shows the full tree of annotated elements
 * from the Astro page, with click-to-select and inline editing.
 *
 * Reads ElementNodes produced by the AstroAdapter and renders them
 * as a collapsible tree grouped by component file.
 */

import type { ElementNode, PropertyChange } from "@editable-jsx/core"
import { ComponentTree } from "@editable-jsx/core"
import { AstroAdapter, buildTreeFromDOM, readSourceAnnotation } from "../adapter.js"
import type { AstroPatch } from "../types.js"

/**
 * TreePanel — builds and renders the component tree in the editor.
 */
export class TreePanel {
  private container: HTMLElement
  private tree: ComponentTree = new ComponentTree()
  private selectedId: string | null = null
  private onSelect: (node: ElementNode) => void

  // Selection overlay on the page
  private overlay: HTMLElement | null = null
  private shadowRoot: ShadowRoot

  constructor(
    container: HTMLElement,
    shadowRoot: ShadowRoot,
    onSelect: (node: ElementNode) => void,
  ) {
    this.container = container
    this.shadowRoot = shadowRoot
    this.onSelect = onSelect

    // Create overlay
    this.overlay = document.createElement("div")
    this.overlay.className = "css-editor-overlay"
    this.overlay.style.display = "none"
    this.shadowRoot.appendChild(this.overlay)
  }

  /**
   * Scan the DOM and rebuild the tree.
   */
  refresh(): void {
    this.tree.clear()
    const nodes = buildTreeFromDOM()
    for (const node of nodes) {
      this.tree.upsert(node)
    }
    this.render()
  }

  /**
   * Render the tree into the container.
   */
  render(): void {
    this.container.textContent = ""

    const roots = this.tree.roots()
    if (roots.length === 0) {
      const empty = document.createElement("div")
      empty.className = "empty-state"
      const p = document.createElement("p")
      p.textContent = "No annotated elements found"
      const p2 = document.createElement("p")
      p2.textContent = "Make sure @editable-jsx/astro is configured"
      empty.appendChild(p)
      empty.appendChild(p2)
      this.container.appendChild(empty)
      return
    }

    // Count by component file for stats
    const fileCount = new Set(
      Array.from(this.tree.nodes.values()).map((n) => n.sourceFile),
    ).size

    const info = document.createElement("div")
    info.className = "footer-info"
    info.style.cssText = "padding:4px 0 8px;font-size:11px"
    info.textContent = `${this.tree.nodes.size} elements \u00b7 ${fileCount} files`
    this.container.appendChild(info)

    // Render tree
    const treeContainer = document.createElement("div")
    this.tree.walk((node, depth) => {
      const row = this.createTreeRow(node, depth)
      treeContainer.appendChild(row)
    })
    this.container.appendChild(treeContainer)
  }

  private createTreeRow(node: ElementNode, depth: number): HTMLElement {
    const row = document.createElement("div")
    row.style.cssText = `
      padding: 3px 8px 3px ${8 + depth * 16}px;
      cursor: pointer;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.1s;
      font-size: 12px;
      font-family: ui-monospace, monospace;
    `

    if (node.id === this.selectedId) {
      row.style.background = "rgba(59, 130, 246, 0.15)"
    }

    // Collapse arrow for nodes with children
    if (node.childIds.length > 0) {
      const arrow = document.createElement("span")
      arrow.textContent = "\u25B6"
      arrow.style.cssText = "font-size:8px;color:#475569;transform:rotate(90deg);display:inline-block"
      row.appendChild(arrow)
    } else {
      const spacer = document.createElement("span")
      spacer.style.width = "8px"
      row.appendChild(spacer)
    }

    // Element name
    const label = document.createElement("span")
    if (node.componentName) {
      // Component — bright color
      label.style.color = "#f472b6"
      label.textContent = `<${node.componentName}>`
    } else {
      // Plain element — dimmer
      label.style.color = "#94a3b8"
      label.textContent = `<${node.elementName}>`
    }
    row.appendChild(label)

    // Class names (if any)
    const classAttr = node.properties.find(
      (p) => p.kind === "attribute" && p.name === "class",
    )
    if (classAttr && classAttr.kind === "attribute" && classAttr.value) {
      const cls = document.createElement("span")
      cls.style.cssText = "color:#475569;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px"
      cls.textContent = `.${classAttr.value.split(/\s+/).slice(0, 2).join(".")}`
      cls.title = classAttr.value
      row.appendChild(cls)
    }

    // Source file hint
    const filePart = node.sourceFile.replace(/^.*\/src\//, "").replace(/\.astro$/, "")
    const source = document.createElement("span")
    source.style.cssText = "color:#334155;font-size:9px;margin-left:auto"
    source.textContent = filePart
    row.appendChild(source)

    // Hover + click
    row.addEventListener("mouseenter", () => {
      if (node.id !== this.selectedId) {
        row.style.background = "rgba(255,255,255,0.04)"
      }
      this.highlightElement(node)
    })
    row.addEventListener("mouseleave", () => {
      if (node.id !== this.selectedId) {
        row.style.background = ""
      }
      this.hideOverlay()
    })
    row.addEventListener("click", () => {
      this.selectedId = node.id
      this.onSelect(node)
      this.render() // re-render to update selection highlight
      this.highlightElement(node)
    })

    return row
  }

  private highlightElement(node: ElementNode): void {
    if (!node.domNode || !this.overlay) return
    const rect = node.domNode.getBoundingClientRect()
    this.overlay.style.display = ""
    this.overlay.style.left = `${rect.left}px`
    this.overlay.style.top = `${rect.top}px`
    this.overlay.style.width = `${rect.width}px`
    this.overlay.style.height = `${rect.height}px`

    // Label
    let label = this.overlay.querySelector(".css-editor-overlay-label") as HTMLElement
    if (!label) {
      label = document.createElement("div")
      label.className = "css-editor-overlay-label"
      this.overlay.appendChild(label)
    }
    label.textContent = node.displayName
  }

  private hideOverlay(): void {
    if (this.overlay) this.overlay.style.display = "none"
  }

  destroy(): void {
    this.overlay?.remove()
  }
}
