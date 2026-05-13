import type { PluginOption } from "vite"
import { createCSSEditorPlugin } from "./server/index.js"
import type { AstroIntegration, CSSEditorOptions } from "./types.js"

export type { CSSEditorOptions, CSSPatch, CSSVariable, CSSVariableManifest } from "./types.js"

/**
 * CSS Editor — Vite plugin for visual CSS editing.
 *
 * Works with any Vite-based project: React, Vue, Svelte, Astro, vanilla HTML.
 * Provides a floating panel for editing CSS variables, inspecting styles,
 * and saving changes back to source files.
 *
 * @example Vite
 * ```ts
 * import { cssEditor } from "@editable-jsx/css"
 *
 * export default defineConfig({
 *   plugins: [cssEditor()]
 * })
 * ```
 *
 * @example Astro
 * ```ts
 * import { cssEditorAstro } from "@editable-jsx/css"
 *
 * export default defineConfig({
 *   integrations: [cssEditorAstro()]
 * })
 * ```
 */
export function cssEditor(options: CSSEditorOptions = {}): PluginOption {
  return createCSSEditorPlugin(options)
}

/**
 * CSS Editor — Astro integration.
 *
 * Wraps the Vite plugin and only activates during `astro dev`.
 * Automatically includes `.astro` files in the scan.
 */
export function cssEditorAstro(
  editorOptions: CSSEditorOptions = {},
): AstroIntegration {
  return {
    name: "editable-css",
    hooks: {
      "astro:config:setup": ({ updateConfig, command, injectScript }) => {
        if (command !== "dev") return

        // Ensure .astro files are included in the scan
        const include = editorOptions.include ?? ["**/*.css", "**/*.astro"]
        if (!include.some((p: string) => p.includes(".astro"))) {
          include.push("**/*.astro")
        }

        updateConfig({
          // Enable Astro's built-in source annotations on every element.
          // This adds data-astro-source-file and data-astro-source-loc
          // attributes in dev mode — our editor uses these for text save.
          devToolbar: { enabled: true },
          vite: {
            plugins: [cssEditor({ ...editorOptions, include })],
          },
        })

        // Astro doesn't use transformIndexHtml, so inject scripts via Astro's API
        const shortcut = editorOptions.shortcut || "meta+shift+c"
        // Use head-inline for the options (synchronous, no Vite resolution)
        injectScript(
          "head-inline",
          `window.__CSS_EDITOR_OPTIONS__ = ${JSON.stringify({ shortcut })};`,
        )
        // Use page stage for the module imports (Vite-resolved)
        injectScript("page", `import "@editable-jsx/css/client";`)
        injectScript("page", `import "@editable-jsx/css/editor";`)
      },
    },
  }
}
