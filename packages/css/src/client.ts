import type { CSSPatch, CSSVariableManifest } from "./types.js"

/**
 * Client-side HMR bridge for the CSS editor.
 * Uses Vite's import.meta.hot for communication with the dev server.
 *
 * Each call registers a one-shot listener that deregisters itself
 * on first response to avoid listener leaks.
 */
export const cssClient = {
  /**
   * Request the CSS variable manifest from the server.
   */
  async scan(): Promise<CSSVariableManifest> {
    return new Promise((resolve, reject) => {
      if (!import.meta.hot) {
        reject(new Error("HMR not available"))
        return
      }

      const handler = (result: any) => {
        import.meta.hot!.off("editable-css:scan:result", handler)
        resolve(result as CSSVariableManifest)
      }

      import.meta.hot!.on("editable-css:scan:result", handler)
      import.meta.hot!.send("editable-css:scan", {})
    })
  },

  /**
   * Send CSS patches to the server to apply and save to source files.
   */
  async save(patches: CSSPatch | CSSPatch[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!import.meta.hot) {
        reject(new Error("HMR not available"))
        return
      }

      const handler = (result: any) => {
        import.meta.hot!.off("editable-css:save:result", handler)
        if (result.success) {
          resolve()
        } else {
          reject(new Error(result.error || "Save failed"))
        }
      }

      import.meta.hot!.on("editable-css:save:result", handler)
      import.meta.hot!.send("editable-css:save", patches as any)
    })
  },

  /**
   * Subscribe to manifest updates pushed by the server
   * when CSS/Astro files change.
   */
  onManifestUpdated(
    callback: (manifest: CSSVariableManifest) => void,
  ): () => void {
    if (!import.meta.hot) return () => {}

    const handler = (data: any) => callback(data as CSSVariableManifest)
    import.meta.hot.on("editable-css:manifest-updated", handler)

    return () => {
      import.meta.hot?.off("editable-css:manifest-updated", handler)
    }
  },
}

// Make client available globally for the editor UI
;(window as any).__cssEditorClient = cssClient
