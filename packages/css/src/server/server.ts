import { resolve } from "node:path"
import type { ViteDevServer } from "vite"
import { applyPatches } from "../patcher/index.js"
import { buildManifest } from "../scanner/manifest.js"
import type { CSSEditorOptions, CSSPatch, CSSVariableManifest } from "../types.js"

/**
 * Configure the Vite dev server with HMR handlers for the CSS editor.
 */
export function configureServer(options: CSSEditorOptions) {
  let manifest: CSSVariableManifest | null = null

  return (server: ViteDevServer) => {
    const rootDir = server.config.root

    // ── Scan: client requests the CSS variable manifest ──────────
    server.hot.on(
      "editable-css:scan",
      async (_data: any, client: any) => {
        try {
          manifest = await buildManifest(rootDir, options)
          client.send("editable-css:scan:result", manifest)
        } catch (error: any) {
          console.error("[editable-css] Scan failed:", error)
          client.send("editable-css:scan:result", {
            variables: [],
            files: [],
            scannedAt: Date.now(),
          })
        }
      },
    )

    // ── Save: client sends CSS patches to apply ──────────────────
    server.hot.on(
      "editable-css:save",
      async (data: CSSPatch | CSSPatch[], client: any) => {
        try {
          if (!data) throw new Error("No patch data")
          if (!Array.isArray(data)) data = [data]

          await applyPatches(data)

          // Re-scan after saving to update the manifest
          manifest = await buildManifest(rootDir, options)

          client.send("editable-css:save:result", { success: true })
        } catch (error: any) {
          client.send("editable-css:save:result", {
            success: false,
            error: error.message,
          })
        }
      },
    )

    // ── Watch for CSS/Astro file changes and push updated manifest ─
    const watchPatterns = [
      resolve(rootDir, "src/**/*.css"),
      resolve(rootDir, "src/**/*.astro"),
    ]

    server.watcher.on("change", async (changedFile: string) => {
      if (
        !changedFile.endsWith(".css") &&
        !changedFile.endsWith(".astro")
      ) {
        return
      }

      // Debounce: only re-scan if the file is in our scan scope
      const included = (options.scanDirs || ["src"]).some((dir) =>
        changedFile.startsWith(resolve(rootDir, dir)),
      )
      if (!included) return

      try {
        manifest = await buildManifest(rootDir, options)
        // Broadcast to all connected clients
        server.hot.send("editable-css:manifest-updated", manifest)
      } catch {
        // Ignore scan failures on file change
      }
    })
  }
}
