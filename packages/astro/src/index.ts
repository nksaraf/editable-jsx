import type { PluginOption } from "vite"
import { cssEditor, type CSSEditorOptions } from "@editable-jsx/css"
import type { AstroEditorOptions } from "./types.js"
import { createAnnotatePlugin } from "./transform/vite-plugin.js"
import { createAstroEditorPlugin } from "./server/index.js"

export type { AstroEditorOptions, AstroPatch, AstroSourceAnnotation } from "./types.js"
export { annotateAstroTemplate } from "./transform/annotate.js"
export { AstroAdapter, elementFromDOM, buildTreeFromDOM, readSourceAnnotation } from "./adapter.js"

/**
 * Astro integration for editable-jsx.
 *
 * Combines three capabilities:
 * 1. Template annotation — injects data-editable-* attrs on every element
 * 2. Template patching — edits attributes and text via @astrojs/compiler
 * 3. CSS editing — delegates to @editable-jsx/css for styles and variables
 *
 * Usage in astro.config.mjs:
 * ```ts
 * import { astroEditor } from "@editable-jsx/astro"
 * export default defineConfig({
 *   integrations: [astroEditor()]
 * })
 * ```
 */
export function astroEditor(options: AstroEditorOptions = {}) {
  return {
    name: "@editable-jsx/astro",
    hooks: {
      "astro:config:setup": (ctx: {
        updateConfig: (config: any) => void
        command: string
        injectScript: (stage: string, content: string) => void
      }) => {
        if (ctx.command !== "dev") return

        const plugins: PluginOption[] = [
          // 1. Annotate .astro templates with source metadata
          createAnnotatePlugin(options),
          // 2. HMR server for attribute/text saves
          createAstroEditorPlugin(options),
        ]

        // 3. CSS editing (unless explicitly disabled)
        if (options.cssEditing !== false) {
          const cssOptions: CSSEditorOptions = {
            include: ["**/*.css", "**/*.astro"],
            shortcut: options.shortcut || "meta+shift+e",
          }
          plugins.push(cssEditor(cssOptions) as PluginOption)
        }

        ctx.updateConfig({ vite: { plugins } })

        // Inject client scripts
        const shortcut = options.shortcut || "meta+shift+e"

        // CRITICAL: Capture source annotations before Astro's dev toolbar
        // strips them. Astro's processAnnotations() runs on DOMContentLoaded
        // and REMOVES data-astro-source-file/loc from every element, storing
        // them in a WeakMap. We capture them first into our own Map.
        ctx.injectScript(
          "head-inline",
          `window.__editableSourceMap__ = new Map();
           document.addEventListener("DOMContentLoaded", function() {
             document.querySelectorAll("[data-astro-source-file]").forEach(function(el) {
               window.__editableSourceMap__.set(el, {
                 file: el.getAttribute("data-astro-source-file"),
                 location: el.getAttribute("data-astro-source-loc") || ""
               });
             });
           });`,
        )

        ctx.injectScript(
          "head-inline",
          `window.__ASTRO_EDITOR_OPTIONS__ = ${JSON.stringify({ shortcut })};`,
        )
        ctx.injectScript("page", `import "@editable-jsx/astro/client";`)
        ctx.injectScript("page", `import "@editable-jsx/astro/editor";`)

        // CSS editor scripts are injected by the css plugin's transformIndexHtml
        // (which doesn't work for Astro), so inject them manually
        if (options.cssEditing !== false) {
          ctx.injectScript(
            "head-inline",
            `window.__CSS_EDITOR_OPTIONS__ = ${JSON.stringify({ shortcut })};`,
          )
          ctx.injectScript("page", `import "@editable-jsx/css/client";`)
          ctx.injectScript("page", `import "@editable-jsx/css/editor";`)
        }
      },
    },
  }
}
