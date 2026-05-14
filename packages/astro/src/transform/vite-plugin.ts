/**
 * Vite plugin that annotates .astro files with source metadata.
 *
 * Runs as `enforce: "pre"` so annotations are injected into the
 * .astro source BEFORE Astro's own compiler processes it.
 * The annotations survive compilation and appear in the rendered HTML.
 */
import type { Plugin } from "vite"
import type { AstroEditorOptions } from "../types.js"
import { annotateAstroTemplate } from "./annotate.js"

export function createAnnotatePlugin(
  options: AstroEditorOptions = {},
): Plugin {
  const excludePatterns = options.exclude || []

  return {
    name: "editable-astro:annotate",
    enforce: "pre",

    async transform(code, id) {
      // Only process .astro files
      if (!id.endsWith(".astro")) return null

      // Skip excluded files
      if (excludePatterns.some((re) => re.test(id))) return null

      try {
        const annotated = await annotateAstroTemplate(code, id)
        return { code: annotated, map: null }
      } catch (err) {
        // Don't break the build — log and pass through
        console.warn(`[editable-astro] Failed to annotate ${id}:`, err)
        return null
      }
    },
  }
}
