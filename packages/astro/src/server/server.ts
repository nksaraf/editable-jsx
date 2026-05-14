import type { ViteDevServer } from "vite"
import type { AstroEditorOptions, AstroPatch } from "../types.js"
import { applyPatches } from "../patcher/index.js"

export function configureServer(_options: AstroEditorOptions) {
  return (server: ViteDevServer) => {
    server.hot.on(
      "editable-astro:save",
      async (data: AstroPatch | AstroPatch[], client: any) => {
        try {
          if (!data) throw new Error("No patch data")
          if (!Array.isArray(data)) data = [data]
          await applyPatches(data)
          client.send("editable-astro:save:result", { success: true })
        } catch (error: any) {
          client.send("editable-astro:save:result", {
            success: false,
            error: error.message,
          })
        }
      },
    )
  }
}
