/**
 * Shared patch orchestration — groups patches by file and applies them
 * in parallel with error collection.
 *
 * Used by all framework-specific patchers (JSX/ts-morph, CSS/PostCSS, Astro/compiler).
 */

// ── Per-file mutex ─────────────────────────────────────────────────

/**
 * Simple async mutex: serializes access per key (file path).
 * Two concurrent `applyPatches` calls on the same file will
 * be sequenced rather than racing.
 */
const fileLocks = new Map<string, Promise<void>>()

async function withFileLock(
  file: string,
  fn: () => Promise<void>,
): Promise<void> {
  // Wait for the previous operation on this file (if any)
  const prev = fileLocks.get(file) ?? Promise.resolve()

  // Chain our work after the previous promise.
  // We store the chain BEFORE awaiting so the next caller sees us.
  const current = prev.then(fn, fn)
  fileLocks.set(file, current)

  try {
    await current
  } finally {
    // Clean up if we're still the tail of the chain
    if (fileLocks.get(file) === current) {
      fileLocks.delete(file)
    }
  }
}

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
 * Per-file access is serialized via an async mutex so that two
 * concurrent `applyPatches` calls on the same file don't race.
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
        await withFileLock(file, () => applyFileFn(file, filePatches))
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
