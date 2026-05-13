import type { CSSVariableManifest, CSSVariablePatch } from "../types.js"
import { DOMPicker } from "./dom-picker.js"
import { renderInspector } from "./inspector.js"
import { EDITOR_STYLES } from "./styles.js"
import { VariableEditor } from "./variable-editor.js"

type Tab = "variables" | "inspect"

/**
 * Main editor panel — floating UI with tabs for Variables and Inspect.
 * Lives inside a Shadow DOM to isolate styles from the host page.
 */
export class EditorPanel {
  private host: HTMLElement
  private shadow: ShadowRoot
  private panel: HTMLElement | null = null
  private toggleBtn: HTMLElement | null = null
  private visible: boolean = false
  private activeTab: Tab = "variables"

  private variableEditor: VariableEditor | null = null
  private domPicker: DOMPicker | null = null

  private variablesContent: HTMLElement | null = null
  private inspectContent: HTMLElement | null = null

  private manifest: CSSVariableManifest | null = null
  private client: any // cssClient from client.ts

  // Drag state
  private dragging = false
  private dragOffset = { x: 0, y: 0 }

  constructor() {
    // Create shadow host
    this.host = document.createElement("div")
    this.host.setAttribute("data-css-editor", "")
    this.host.style.cssText =
      "position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 99999; pointer-events: none;"
    document.body.appendChild(this.host)

    this.shadow = this.host.attachShadow({ mode: "open" })

    // Inject styles
    const style = document.createElement("style")
    style.textContent = EDITOR_STYLES
    this.shadow.appendChild(style)

    // Get the HMR client
    this.client = (window as any).__cssEditorClient

    // Create DOM picker
    this.domPicker = new DOMPicker(
      this.shadow,
      (el) => this.onElementSelected(el),
      () => this.onElementDeselected(),
    )

    // Create toggle button
    this.createToggleButton()

    // Listen for scroll/resize to update overlays
    window.addEventListener("scroll", () => this.domPicker?.updateOverlays(), {
      passive: true,
    })
    window.addEventListener(
      "resize",
      () => this.domPicker?.updateOverlays(),
      { passive: true },
    )
  }

  /**
   * Show the editor panel.
   */
  async show(): Promise<void> {
    if (this.visible) return
    this.visible = true

    if (this.toggleBtn) this.toggleBtn.style.display = "none"

    if (!this.panel) {
      this.createPanel()
    }
    this.panel!.style.display = ""

    // Request manifest on first show
    if (!this.manifest && this.client) {
      try {
        this.manifest = await this.client.scan()
        this.renderActiveTab()
      } catch (err) {
        console.error("[editable-css] Failed to scan:", err)
      }
    }
  }

  /**
   * Hide the editor panel.
   */
  hide(): void {
    if (!this.visible) return
    this.visible = false

    if (this.panel) this.panel.style.display = "none"
    if (this.toggleBtn) this.toggleBtn.style.display = ""

    this.domPicker?.deactivate()
    this.domPicker?.clearSelection()
  }

  /**
   * Toggle editor visibility.
   */
  toggle(): void {
    if (this.visible) {
      this.hide()
    } else {
      this.show()
    }
  }

  /**
   * Update the manifest (called when server pushes an update).
   */
  updateManifest(manifest: CSSVariableManifest): void {
    this.manifest = manifest
    if (this.visible && this.activeTab === "variables") {
      this.renderActiveTab()
    }
  }

  /**
   * Clean up all DOM and listeners.
   */
  destroy(): void {
    this.domPicker?.destroy()
    this.host.remove()
  }

  // ── Private ─────────────────────────────────────────────

  private createToggleButton(): void {
    this.toggleBtn = document.createElement("button")
    this.toggleBtn.className = "css-editor-toggle"
    this.toggleBtn.style.pointerEvents = "auto"

    const shortcut =
      (window as any).__CSS_EDITOR_OPTIONS__?.shortcut || "meta+shift+c"
    const shortcutDisplay = shortcut
      .replace("meta", "\u2318")
      .replace("shift", "\u21E7")
      .replace("alt", "\u2325")
      .replace("+", "")
      .toUpperCase()

    this.toggleBtn.textContent = `${shortcutDisplay} CSS Editor`
    this.toggleBtn.addEventListener("click", () => this.show())

    this.shadow.appendChild(this.toggleBtn)
  }

  private createPanel(): void {
    this.panel = document.createElement("div")
    this.panel.className = "css-editor-panel"
    this.panel.style.pointerEvents = "auto"

    // Header
    const header = document.createElement("div")
    header.className = "panel-header"

    const title = document.createElement("span")
    title.className = "panel-title"
    title.textContent = "CSS Editor"

    const actions = document.createElement("div")
    actions.className = "panel-actions"

    const closeBtn = document.createElement("button")
    closeBtn.className = "panel-btn"
    closeBtn.textContent = "\u2715"
    closeBtn.title = "Close"
    closeBtn.addEventListener("click", () => this.hide())

    actions.appendChild(closeBtn)
    header.appendChild(title)
    header.appendChild(actions)

    // Make header draggable
    this.setupDrag(header)

    // Tabs
    const tabs = document.createElement("div")
    tabs.className = "panel-tabs"

    const varTab = this.createTab("Variables", "variables")
    const inspectTab = this.createTab("Inspect", "inspect")

    tabs.appendChild(varTab)
    tabs.appendChild(inspectTab)

    // Content areas
    this.variablesContent = document.createElement("div")
    this.variablesContent.className = "panel-content"

    this.inspectContent = document.createElement("div")
    this.inspectContent.className = "panel-content"
    this.inspectContent.style.display = "none"

    // Variable editor
    this.variableEditor = new VariableEditor(
      this.variablesContent,
      (patches) => this.handleSave(patches),
    )

    // Initial inspect prompt
    this.renderInspectPrompt()

    this.panel.appendChild(header)
    this.panel.appendChild(tabs)
    this.panel.appendChild(this.variablesContent)
    this.panel.appendChild(this.inspectContent)
    this.shadow.appendChild(this.panel)

    this.renderActiveTab()
  }

  private createTab(label: string, tab: Tab): HTMLElement {
    const btn = document.createElement("button")
    btn.className = `panel-tab${tab === this.activeTab ? " active" : ""}`
    btn.textContent = label
    btn.addEventListener("click", () => {
      this.activeTab = tab
      this.updateTabUI()
      this.renderActiveTab()

      // If switching to inspect, activate picker
      if (tab === "inspect" && !this.domPicker?.getSelectedElement()) {
        this.domPicker?.activate()
      }
    })
    btn.setAttribute("data-tab", tab)
    return btn
  }

  private updateTabUI(): void {
    if (!this.panel) return
    const tabs = this.panel.querySelectorAll(".panel-tab")
    tabs.forEach((tab) => {
      const isActive = tab.getAttribute("data-tab") === this.activeTab
      tab.classList.toggle("active", isActive)
    })

    if (this.variablesContent) {
      this.variablesContent.style.display =
        this.activeTab === "variables" ? "" : "none"
    }
    if (this.inspectContent) {
      this.inspectContent.style.display =
        this.activeTab === "inspect" ? "" : "none"
    }
  }

  private renderActiveTab(): void {
    if (this.activeTab === "variables" && this.manifest) {
      this.variableEditor?.render(this.manifest)
    }
  }

  private renderInspectPrompt(): void {
    if (!this.inspectContent) return
    this.inspectContent.textContent = ""

    const prompt = document.createElement("div")
    prompt.className = "inspect-prompt"

    const p1 = document.createElement("p")
    p1.textContent = "Click on any element to inspect its styles"

    const p2 = document.createElement("p")
    const kbd = document.createElement("kbd")
    kbd.textContent = "Esc"
    p2.appendChild(document.createTextNode("Press "))
    p2.appendChild(kbd)
    p2.appendChild(document.createTextNode(" to cancel"))

    prompt.appendChild(p1)
    prompt.appendChild(p2)
    this.inspectContent.appendChild(prompt)
  }

  private onElementSelected(el: Element): void {
    if (!this.inspectContent) return

    renderInspector(this.inspectContent, el, (selector, property, value) => {
      // Save property change
      // For now, just log — full save needs source mapping
      console.log(
        `[editable-css] Property changed: ${selector} { ${property}: ${value} }`,
      )
    })

    // Switch to inspect tab if not already there
    if (this.activeTab !== "inspect") {
      this.activeTab = "inspect"
      this.updateTabUI()
    }
  }

  private onElementDeselected(): void {
    this.renderInspectPrompt()
  }

  private async handleSave(patches: CSSVariablePatch[]): Promise<void> {
    if (!this.client) {
      console.error("[editable-css] No HMR client available")
      return
    }

    try {
      await this.client.save(patches)
      console.log(`[editable-css] Saved ${patches.length} variable(s)`)
    } catch (err) {
      console.error("[editable-css] Save failed:", err)
    }
  }

  private setupDrag(header: HTMLElement): void {
    header.addEventListener("pointerdown", (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest(".panel-btn")) return

      this.dragging = true
      const panelRect = this.panel!.getBoundingClientRect()
      this.dragOffset = {
        x: e.clientX - panelRect.left,
        y: e.clientY - panelRect.top,
      }

      header.setPointerCapture(e.pointerId)
    })

    header.addEventListener("pointermove", (e: PointerEvent) => {
      if (!this.dragging || !this.panel) return

      const x = e.clientX - this.dragOffset.x
      const y = e.clientY - this.dragOffset.y

      this.panel.style.right = "auto"
      this.panel.style.left = `${Math.max(0, x)}px`
      this.panel.style.top = `${Math.max(0, y)}px`
    })

    header.addEventListener("pointerup", () => {
      this.dragging = false
    })
  }
}
