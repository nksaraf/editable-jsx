/**
 * DOM Picker — click-to-select behavior for the CSS inspector.
 *
 * When active:
 * - Hover highlights elements with a dashed blue border
 * - Click selects the element and opens the inspector
 * - Escape cancels picking mode
 */
export class DOMPicker {
  private active: boolean = false
  private hoverOverlay: HTMLElement | null = null
  private selectionOverlay: HTMLElement | null = null
  private selectedElement: Element | null = null
  private shadowRoot: ShadowRoot
  private onSelect: (el: Element) => void
  private onDeselect: () => void

  private boundMouseMove: (e: MouseEvent) => void
  private boundClick: (e: MouseEvent) => void
  private boundKeyDown: (e: KeyboardEvent) => void

  constructor(
    shadowRoot: ShadowRoot,
    onSelect: (el: Element) => void,
    onDeselect: () => void,
  ) {
    this.shadowRoot = shadowRoot
    this.onSelect = onSelect
    this.onDeselect = onDeselect

    this.boundMouseMove = this.handleMouseMove.bind(this)
    this.boundClick = this.handleClick.bind(this)
    this.boundKeyDown = this.handleKeyDown.bind(this)

    // Create overlays in the shadow root
    this.hoverOverlay = document.createElement("div")
    this.hoverOverlay.className = "css-editor-hover-overlay"
    this.hoverOverlay.style.display = "none"
    this.shadowRoot.appendChild(this.hoverOverlay)

    this.selectionOverlay = document.createElement("div")
    this.selectionOverlay.className = "css-editor-overlay"
    this.selectionOverlay.style.display = "none"
    this.shadowRoot.appendChild(this.selectionOverlay)
  }

  /**
   * Start picking mode — attach event listeners.
   */
  activate(): void {
    if (this.active) return
    this.active = true

    document.addEventListener("mousemove", this.boundMouseMove, true)
    document.addEventListener("click", this.boundClick, true)
    document.addEventListener("keydown", this.boundKeyDown, true)

    document.body.style.cursor = "crosshair"
  }

  /**
   * Stop picking mode — remove event listeners.
   */
  deactivate(): void {
    if (!this.active) return
    this.active = false

    document.removeEventListener("mousemove", this.boundMouseMove, true)
    document.removeEventListener("click", this.boundClick, true)
    document.removeEventListener("keydown", this.boundKeyDown, true)

    document.body.style.cursor = ""
    this.hideHoverOverlay()
  }

  /**
   * Check if picking mode is active.
   */
  isActive(): boolean {
    return this.active
  }

  /**
   * Get the currently selected element.
   */
  getSelectedElement(): Element | null {
    return this.selectedElement
  }

  /**
   * Clear selection.
   */
  clearSelection(): void {
    this.selectedElement = null
    this.hideSelectionOverlay()
    this.onDeselect()
  }

  /**
   * Update the selection overlay position (call on scroll/resize).
   */
  updateOverlays(): void {
    if (this.selectedElement) {
      this.showSelectionOverlay(this.selectedElement)
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const target = e.target as Element
    if (!target || this.isEditorElement(target)) {
      this.hideHoverOverlay()
      return
    }
    this.showHoverOverlay(target)
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as Element
    if (!target || this.isEditorElement(target)) return

    e.preventDefault()
    e.stopPropagation()

    this.selectedElement = target
    this.showSelectionOverlay(target)
    this.hideHoverOverlay()
    this.deactivate()
    this.onSelect(target)
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault()
      this.deactivate()
      this.onDeselect()
    }
  }

  private isEditorElement(el: Element): boolean {
    // Check if the element is part of our editor UI
    return !!el.closest("[data-css-editor]")
  }

  private showHoverOverlay(el: Element): void {
    if (!this.hoverOverlay) return
    const rect = el.getBoundingClientRect()
    this.hoverOverlay.style.display = ""
    this.hoverOverlay.style.left = `${rect.left}px`
    this.hoverOverlay.style.top = `${rect.top}px`
    this.hoverOverlay.style.width = `${rect.width}px`
    this.hoverOverlay.style.height = `${rect.height}px`
  }

  private hideHoverOverlay(): void {
    if (this.hoverOverlay) {
      this.hoverOverlay.style.display = "none"
    }
  }

  private showSelectionOverlay(el: Element): void {
    if (!this.selectionOverlay) return
    const rect = el.getBoundingClientRect()
    this.selectionOverlay.style.display = ""
    this.selectionOverlay.style.left = `${rect.left}px`
    this.selectionOverlay.style.top = `${rect.top}px`
    this.selectionOverlay.style.width = `${rect.width}px`
    this.selectionOverlay.style.height = `${rect.height}px`

    // Label
    let label = this.selectionOverlay.querySelector(
      ".css-editor-overlay-label",
    ) as HTMLElement
    if (!label) {
      label = document.createElement("div")
      label.className = "css-editor-overlay-label"
      this.selectionOverlay.appendChild(label)
    }

    const tagName = el.tagName.toLowerCase()
    const classes = el.className
      ? `.${String(el.className).split(/\s+/).filter(Boolean).join(".")}`
      : ""
    const id = el.id ? `#${el.id}` : ""
    label.textContent = `${tagName}${id}${classes}`
  }

  private hideSelectionOverlay(): void {
    if (this.selectionOverlay) {
      this.selectionOverlay.style.display = "none"
    }
  }

  /**
   * Clean up — remove overlays and event listeners.
   */
  destroy(): void {
    this.deactivate()
    this.hoverOverlay?.remove()
    this.selectionOverlay?.remove()
  }
}
