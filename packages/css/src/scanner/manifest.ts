import fg from "fast-glob"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type {
  CSSEditorOptions,
  CSSVariable,
  CSSVariableManifest,
} from "../types.js"
import { parseAstroVariables } from "./parse-astro.js"
import { parseCSSVariables } from "./parse-css.js"

/**
 * Scan the project for CSS files and .astro files,
 * extract all CSS custom property declarations, and build a manifest.
 */
export async function buildManifest(
  rootDir: string,
  options: CSSEditorOptions = {},
): Promise<CSSVariableManifest> {
  const {
    include = ["**/*.css", "**/*.astro"],
    exclude = ["**/node_modules/**", "**/dist/**", "**/.astro/**"],
    scanDirs = ["src"],
  } = options

  // Build glob patterns rooted in scanDirs
  const patterns = scanDirs.flatMap((dir) =>
    include.map((pattern) => `${dir}/${pattern}`),
  )

  const files = await fg(patterns, {
    cwd: rootDir,
    absolute: true,
    ignore: exclude,
  })

  const variables: CSSVariable[] = []
  const scannedFiles: string[] = []

  for (const file of files) {
    try {
      const content = readFileSync(file, "utf-8")
      scannedFiles.push(file)

      if (file.endsWith(".astro")) {
        variables.push(...parseAstroVariables(content, file))
      } else if (file.endsWith(".css")) {
        variables.push(...parseCSSVariables(content, file))
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return {
    variables,
    files: scannedFiles,
    scannedAt: Date.now(),
  }
}

/**
 * Group variables by file and scope for UI display.
 */
export function groupVariables(
  variables: CSSVariable[],
): Map<string, Map<string, CSSVariable[]>> {
  const byFile = new Map<string, Map<string, CSSVariable[]>>()

  for (const v of variables) {
    if (!byFile.has(v.file)) {
      byFile.set(v.file, new Map())
    }
    const scopes = byFile.get(v.file)!
    if (!scopes.has(v.scope)) {
      scopes.set(v.scope, [])
    }
    scopes.get(v.scope)!.push(v)
  }

  return byFile
}
