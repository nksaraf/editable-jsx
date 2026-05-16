import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Plugin, ViteDevServer } from "vite"
import type { CSSEditorOptions } from "../types.js"
import { filesToSkipOnHmr } from "./hmr.js"
import { configureServer } from "./server.js"

/**
 * Create the Vite plugin for the CSS editor.
 *
 * This plugin:
 * 1. Injects the editor UI and client scripts into the HTML
 * 2. Configures HMR handlers for scanning and saving
 * 3. Suppresses HMR for files we just patched
 * 4. Serves the editor bundle via virtual modules
 */
export function createCSSEditorPlugin(
  options: CSSEditorOptions = {},
): Plugin {
  const shortcut = options.shortcut || "meta+shift+c"

  return {
    name: "editable-css",
    enforce: "pre",

    config() {
      return {
        optimizeDeps: {
          include: ["@editable-jsx/css/client", "@editable-jsx/css/editor"],
        },
      }
    },

    configureServer: configureServer(options),

    /**
     * Inject the editor scripts by resolving the actual file paths.
     * We resolve at serve time so Vite's module graph handles them.
     */
    transformIndexHtml: {
      order: "pre" as const,
      handler() {
        // Use /@id/ prefix which Vite resolves through its module graph
        return [
          {
            tag: "script",
            attrs: { type: "module" },
            children: `window.__CSS_EDITOR_OPTIONS__ = ${JSON.stringify({ shortcut })};`,
            injectTo: "head" as const,
          },
          {
            tag: "script",
            attrs: { type: "module", src: "/@id/@editable-jsx/css/client" },
            injectTo: "body" as const,
          },
          {
            tag: "script",
            attrs: { type: "module", src: "/@id/@editable-jsx/css/editor" },
            injectTo: "body" as const,
          },
        ]
      },
    },

    /**
     * Suppress HMR for files we just patched to avoid a feedback loop.
     */
    handleHotUpdate({ file, server }) {
      const entry = filesToSkipOnHmr.get(file)
      if (entry?.skip) {
        filesToSkipOnHmr.delete(file)
        return [] // Empty array = suppress HMR update
      }
    },
  }
}
