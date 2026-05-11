import { Plugin } from "vite"
import { ServerOptions } from "../types"
import { filesToSkipOnHmr } from "./hmr"
import { configureServer } from "./server"

export const editor = (options: ServerOptions = {}): Plugin => {
  return {
    name: "vite-plugin-react-three-editor",
    enforce: "pre",
    handleHotUpdate(ctx) {
      const entry = filesToSkipOnHmr.get(ctx.file)
      if (entry?.skip === true) {
        // Don't reset skip immediately — Vite can fire multiple HMR events
        // for a single file write. Use the timeout to clear after a window.
        if (entry.timeout) clearTimeout(entry.timeout)
        entry.timeout = setTimeout(() => {
          entry.skip = false
          entry.timeout = null
        }, 1000)

        return []
      }
    },
    transformIndexHtml: async (id, ctx) => {
      // Skip injecting editor CSS — it was R3F-specific and causes 404s
      // in web-only editor setups. Editor UI handles its own styles.
      return []
    },
    configureServer: configureServer(options)
  }
}
