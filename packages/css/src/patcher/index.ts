import { readFileSync, writeFileSync } from "node:fs"
import type { CSSPatch } from "../types.js"
import { filesToSkipOnHmr } from "../server/hmr.js"
import { applyAstroPatches } from "./astro-patcher.js"
import { applyCSSPropertyPatches, applyCSSVariablePatches } from "./css-patcher.js"

/**
 * Group patches by file path.
 */
function groupPatchesByFile(patches: CSSPatch[]): Record<string, CSSPatch[]> {
  return patches.reduce(
    (acc, patch) => {
      const file = patch.file
      ;(acc[file] = acc[file] || []).push(patch)
      return acc
    },
    {} as Record<string, CSSPatch[]>,
  )
}

/**
 * Apply patches to a single file.
 */
async function applyFilePatches(
  file: string,
  patches: CSSPatch[],
): Promise<void> {
  let content = readFileSync(file, "utf-8")

  if (file.endsWith(".astro")) {
    content = applyAstroPatches(content, patches, file)
  } else if (file.endsWith(".css")) {
    // Separate variable and property patches
    const variablePatches = patches.filter(
      (p) => p.action_type === "updateCSSVariable",
    )
    const propertyPatches = patches.filter(
      (p) => p.action_type === "updateCSSProperty",
    )

    if (variablePatches.length > 0) {
      content = applyCSSVariablePatches(
        content,
        variablePatches as any,
        file,
      )
    }
    if (propertyPatches.length > 0) {
      content = applyCSSPropertyPatches(
        content,
        propertyPatches as any,
        file,
      )
    }
  }

  // Tell HMR to skip this file — we already applied the changes
  filesToSkipOnHmr.set(file, { skip: true, timeout: null })
  writeFileSync(file, content)
}

/**
 * Apply all CSS patches, grouped by file.
 * Follows the same error-collection pattern as @editable-jsx/vite.
 */
export async function applyPatches(data: CSSPatch[]): Promise<void> {
  const grouped = groupPatchesByFile(data)
  const errors: Array<{ file: string; error: Error }> = []

  await Promise.all(
    Object.entries(grouped).map(async ([file, patches]) => {
      try {
        await applyFilePatches(file, patches)
      } catch (err: any) {
        console.error(`[editable-css] Failed to apply patches to ${file}:`, err)
        errors.push({ file, error: err })
      }
    }),
  )

  if (errors.length > 0) {
    const fileList = errors.map((e) => e.file).join(", ")
    throw new Error(
      `Patch failed for ${errors.length} file(s): ${fileList}. ${errors[0].error.message}`,
    )
  }
}
