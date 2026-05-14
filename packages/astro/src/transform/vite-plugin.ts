/**
 * Vite plugin for Astro template annotation.
 *
 * The annotation transform (annotateAstroTemplate) works correctly
 * on .astro source files, but integrating it into Astro's Vite pipeline
 * is non-trivial — Astro's compiler expects to be the sole processor
 * of .astro files, and both `load` and `transform` hooks conflict
 * with Astro's internal module system.
 *
 * Current approach: no build-time annotation. The AstroAdapter reads
 * source info from Astro's existing data-astro-cid-* attributes and
 * data-vite-dev-id style tags. The annotateAstroTemplate function is
 * still exported for use in custom build pipelines or future Astro
 * compiler plugin APIs.
 *
 * TODO: When Astro exposes a compiler plugin hook (requested upstream),
 * use it to inject data-editable-* attributes at compile time.
 */
import type { Plugin } from "vite"
import type { AstroEditorOptions } from "../types.js"

export function createAnnotatePlugin(
  _options: AstroEditorOptions = {},
): Plugin {
  return {
    name: "editable-astro:annotate",
    // No-op for now — annotation is deferred until Astro supports
    // compiler plugins. The AstroAdapter uses runtime source
    // resolution (CID + data-vite-dev-id) as a fallback.
  }
}
