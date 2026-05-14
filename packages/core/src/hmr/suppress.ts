import type { HmrSuppressMap } from "../types.js"

/**
 * Create a new HMR suppression map.
 */
export function createSuppressMap(): HmrSuppressMap {
  return new Map()
}

/**
 * Mark a file for HMR suppression with auto-expiry.
 *
 * Call this after writing a file to prevent the write from
 * triggering an HMR update (feedback loop). The entry auto-expires
 * after `ttlMs` milliseconds to prevent stale entries from
 * permanently suppressing HMR.
 */
export function suppressFile(
  map: HmrSuppressMap,
  file: string,
  ttlMs: number = 5000,
): void {
  const existing = map.get(file)
  if (existing?.timeout) clearTimeout(existing.timeout)

  const timeout = setTimeout(() => map.delete(file), ttlMs)
  map.set(file, { skip: true, timeout })
}

/**
 * Create a Vite `handleHotUpdate` handler that suppresses
 * HMR for files in the suppress map.
 *
 * Returns `[]` (empty module array) to suppress the update,
 * or `undefined` to let it proceed normally.
 */
export function createHotUpdateHandler(
  map: HmrSuppressMap,
): (ctx: { file: string }) => [] | undefined {
  return ({ file }) => {
    const entry = map.get(file)
    if (entry?.skip) {
      map.delete(file)
      return [] // Suppress HMR update
    }
    return undefined
  }
}
