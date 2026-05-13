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

    configureServer: configureServer(options),

    /**
     * Inject the editor scripts into the HTML page.
     * The editor UI is self-contained — no framework dependency.
     */
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { type: "module" },
          children: `
            import "@editable-jsx/css/client";
            import "@editable-jsx/css/editor";
          `,
          injectTo: "body",
        },
        {
          tag: "script",
          attrs: { type: "module" },
          children: `
            window.__CSS_EDITOR_OPTIONS__ = ${JSON.stringify({ shortcut })};
          `,
          injectTo: "head",
        },
      ]
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
