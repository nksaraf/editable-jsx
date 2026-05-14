/**
 * Shared patch orchestration — groups patches by file and applies them
 * in parallel with error collection.
 *
 * Used by all framework-specific patchers (JSX/ts-morph, CSS/PostCSS, Astro/compiler).
 */

/**
 * Group patches by file path.
 *
 * The `getFile` callback extracts the file path from a patch,
 * allowing different patch shapes (e.g., `patch.file` vs `patch.source.fileName`).
 */
export function groupPatchesByFile<P>(
  patches: P[],
  getFile: (patch: P) => string,
): Record<string, P[]> {
  return patches.reduce(
    (acc, patch) => {
      const file = getFile(patch)
      ;(acc[file] = acc[file] || []).push(patch)
      return acc
    },
    {} as Record<string, P[]>,
  )
}

/**
 * Apply patches in parallel, grouped by file.
 *
 * Calls `applyFileFn` for each file group. Collects errors from
 * individual files and throws a combined error if any failed.
 *
 * @param patches - All patches to apply
 * @param getFile - Extracts the file path from a patch
 * @param applyFileFn - Applies patches to a single file
 */
export async function applyPatches<P>(
  patches: P[],
  getFile: (patch: P) => string,
  applyFileFn: (file: string, patches: P[]) => Promise<void>,
): Promise<void> {
  const grouped = groupPatchesByFile(patches, getFile)
  const errors: Array<{ file: string; error: Error }> = []

  await Promise.all(
    Object.entries(grouped).map(async ([file, filePatches]) => {
      try {
        await applyFileFn(file, filePatches)
      } catch (err: any) {
        console.error(`[editable] Failed to apply patches to ${file}:`, err)
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
