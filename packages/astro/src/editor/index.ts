/**
 * Astro editor entry point.
 *
 * For now, the @editable-jsx/css editor handles the visual UI.
 * This module bridges the Astro-specific source annotations
 * (data-editable-file, data-editable-line, etc.) into the CSS
 * editor's inspector, giving it exact source positions for
 * text and attribute saves.
 *
 * Future: dedicated component tree view using data-editable-component.
 */

function init(): void {
  console.log("[editable-astro] Editor initialized. Source annotations active.")
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
