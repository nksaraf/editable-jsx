import { EditPatch } from "@editable-jsx/state"

/**
 * Client-side RPC using Vite's HMR channel API (import.meta.hot).
 * Replaces the old vite-dev-rpc dependency.
 *
 * Each call registers a one-shot listener that deregisters itself
 * on first response to avoid listener leaks and cross-call pollution.
 */
export const client = {
  async save(patches: EditPatch | EditPatch[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!import.meta.hot) {
        reject(new Error("HMR not available"))
        return
      }

      const handler = (result: any) => {
        import.meta.hot!.off("editable-jsx:save:result", handler)
        if (result.success) {
          resolve()
        } else {
          reject(new Error(result.error || "Save failed"))
        }
      }

      import.meta.hot!.on("editable-jsx:save:result", handler)
      import.meta.hot!.send("editable-jsx:save", patches as any)
    })
  },

  async initializeComponentsWatcher(): Promise<
    { fileName: string; components: string[] }[]
  > {
    return new Promise((resolve) => {
      if (!import.meta.hot) {
        resolve([])
        return
      }

      const handler = (result: any) => {
        import.meta.hot!.off("editable-jsx:components:result", handler)
        resolve(result)
      }

      import.meta.hot!.on("editable-jsx:components:result", handler)
      import.meta.hot!.send("editable-jsx:components", {})
    })
  }
}
