import { EditorPanel } from "./panel.js"

/**
 * Editor UI entry point — auto-initializes when loaded.
 *
 * This module:
 * 1. Creates the floating editor panel (in Shadow DOM)
 * 2. Sets up the keyboard shortcut to toggle it
 * 3. Subscribes to manifest updates from the server
 */

let panel: EditorPanel | null = null

function init(): void {
  // Don't double-initialize
  if (panel) return

  panel = new EditorPanel()

  // Get options from the injected script
  const options = (window as any).__CSS_EDITOR_OPTIONS__ || {}
  const shortcut = options.shortcut || "meta+shift+c"

  // Parse shortcut into modifier + key
  const parts = shortcut.toLowerCase().split("+")
  const key = parts[parts.length - 1]
  const needsMeta = parts.includes("meta")
  const needsShift = parts.includes("shift")
  const needsCtrl = parts.includes("ctrl")
  const needsAlt = parts.includes("alt")

  // Register keyboard shortcut
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== key) return
    if (needsMeta && !(e.metaKey || e.ctrlKey)) return
    if (needsShift && !e.shiftKey) return
    if (needsCtrl && !e.ctrlKey) return
    if (needsAlt && !e.altKey) return

    e.preventDefault()
    panel!.toggle()
  })

  // Subscribe to manifest updates from the server
  const client = (window as any).__cssEditorClient
  if (client?.onManifestUpdated) {
    client.onManifestUpdated((manifest: any) => {
      panel?.updateManifest(manifest)
    })
  }

  console.log("[editable-css] Editor initialized. Press Cmd+Shift+C to toggle.")
}

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}

export { EditorPanel }
