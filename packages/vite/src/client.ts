import { EditPatch } from "@editable-jsx/state"

/**
 * Client-side RPC using Vite's HMR channel API (import.meta.hot).
 * Replaces the old vite-dev-rpc dependency.
 */
export const client = {
  async save(patches: EditPatch | EditPatch[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!import.meta.hot) {
        reject(new Error("HMR not available"))
        return
      }

      import.meta.hot!.on("editable-jsx:save:result", (result: any) => {
        if (result.success) {
          resolve()
        } else {
          reject(new Error(result.error || "Save failed"))
        }
      })

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

      import.meta.hot!.on(
        "editable-jsx:components:result",
        (result: any) => {
          resolve(result)
        }
      )

      import.meta.hot!.send("editable-jsx:components", {})
    })
  }
}
