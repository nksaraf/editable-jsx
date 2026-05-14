import { makeHmrRequest } from "@editable-jsx/core/client"
import type { AstroPatch } from "./types.js"

export const astroClient = {
  async save(patches: AstroPatch | AstroPatch[]): Promise<void> {
    if (!Array.isArray(patches)) patches = [patches]
    await makeHmrRequest(
      "editable-astro:save",
      "editable-astro:save:result",
      patches,
    )
  },
}

// Make client available globally for the editor UI
;(window as any).__astroEditorClient = astroClient
