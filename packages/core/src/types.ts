/**
 * Source location of an element in a source file.
 * Common across all frameworks (JSX, Astro, Vue, etc.)
 */
export interface SourceLocation {
  fileName: string
  lineNumber: number
  columnNumber: number
}

/**
 * Base patch type. All framework-specific patches extend this.
 * The `action_type` discriminant determines the handler.
 */
export interface BasePatch {
  action_type: string
  file: string
}

/**
 * Map of files to skip during HMR updates.
 * Used to suppress the HMR cycle triggered by our own writes.
 */
export type HmrSuppressMap = Map<
  string,
  { skip: boolean; timeout: ReturnType<typeof setTimeout> | null }
>

/**
 * Result of a save operation sent back to the client.
 */
export interface SaveResult {
  success: boolean
  error?: string
}
