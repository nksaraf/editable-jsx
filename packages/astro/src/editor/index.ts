/**
 * Astro editor entry point.
 *
 * Creates a unified editor with three tabs:
 * 1. Tree — component tree from data-editable-* annotations
 * 2. Inspect — click-to-select with CSS property + text editing (from @editable-jsx/css)
 * 3. Variables — CSS custom property editor (from @editable-jsx/css)
 *
 * The CSS editor panel handles tabs 2 and 3 already.
 * This module adds the Tree tab by hooking into the CSS editor's panel.
 */

import type { ElementNode } from "@editable-jsx/core"
import { TreePanel } from "./tree-panel.js"
import { AstroAdapter } from "../adapter.js"

let treePanel: TreePanel | null = null

function init(): void {
  // Wait for the CSS editor's shadow DOM to be ready
  const checkEditor = () => {
    const host = document.querySelector("[data-css-editor]")
    if (!host?.shadowRoot) {
      setTimeout(checkEditor, 200)
      return
    }

    const sr = host.shadowRoot

    // Find the panel tabs container
    const tabs = sr.querySelector(".panel-tabs")
    if (!tabs) {
      setTimeout(checkEditor, 200)
      return
    }

    // Add a "Tree" tab
    const treeTab = document.createElement("button")
    treeTab.className = "panel-tab"
    treeTab.textContent = "Tree"
    treeTab.setAttribute("data-tab", "tree")

    // Insert as the first tab
    tabs.insertBefore(treeTab, tabs.firstChild)

    // Create the tree content area
    const treeContent = document.createElement("div")
    treeContent.className = "panel-content"
    treeContent.style.display = "none"

    // Find where to insert it (after the tabs, before the first panel-content)
    const firstContent = sr.querySelector(".panel-content")
    if (firstContent?.parentElement) {
      firstContent.parentElement.insertBefore(treeContent, firstContent)
    }

    // Create tree panel
    treePanel = new TreePanel(treeContent, sr, (node: ElementNode) => {
      // When a tree node is selected, switch to inspect tab
      // and trigger element inspection
      if (node.domNode) {
        // Scroll element into view
        node.domNode.scrollIntoView({ behavior: "smooth", block: "center" })

        // Programmatically trigger element selection in the CSS inspector
        // by dispatching a click event (the DOMPicker will intercept it)
        const rect = node.domNode.getBoundingClientRect()
        node.domNode.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          }),
        )
      }
    })

    // Handle tree tab click
    treeTab.addEventListener("click", () => {
      // Deactivate all tabs
      const allTabs = sr.querySelectorAll(".panel-tab")
      allTabs.forEach((t) => t.classList.remove("active"))
      treeTab.classList.add("active")

      // Hide all content panels, show tree
      const allPanels = sr.querySelectorAll(".panel-content")
      allPanels.forEach((p: Element) => {
        ;(p as HTMLElement).style.display = "none"
      })
      treeContent.style.display = ""

      // Refresh tree data
      treePanel?.refresh()
    })

    console.log("[editable-astro] Tree panel added to CSS editor.")
  }

  checkEditor()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  // Delay slightly to let CSS editor initialize first
  setTimeout(init, 100)
}

export { AstroAdapter, TreePanel }
