import glob from "fast-glob"
import { readFileSync } from "fs"

/**
 * List React components found in the given glob pattern.
 * Uses a simple regex-based approach instead of full AST parsing
 * to avoid heavy dependencies like recast.
 */
export async function listComponents(componentsDir: string) {
  const componentFiles = await glob(componentsDir, {
    cwd: process.cwd()
  })

  const files = await Promise.all(
    componentFiles.map((fileName) => listReactComponents(fileName))
  )

  return files.filter((f) => f.components.length)
}

function listReactComponents(
  fileName: string
): { fileName: string; components: string[] } {
  try {
    const source = readFileSync(fileName, "utf-8")

    // Match exported function/const components (PascalCase)
    const components: string[] = []

    // export default function ComponentName
    const defaultFnMatch = source.match(
      /export\s+default\s+function\s+([A-Z]\w*)/g
    )
    if (defaultFnMatch) {
      for (const m of defaultFnMatch) {
        const name = m.match(/function\s+([A-Z]\w*)/)?.[1]
        if (name) components.push(name)
      }
    }

    // export function ComponentName
    const namedFnMatch = source.match(
      /export\s+function\s+([A-Z]\w*)/g
    )
    if (namedFnMatch) {
      for (const m of namedFnMatch) {
        const name = m.match(/function\s+([A-Z]\w*)/)?.[1]
        if (name) components.push(name)
      }
    }

    // export const ComponentName = ...
    const constMatch = source.match(
      /export\s+const\s+([A-Z]\w*)\s*=/g
    )
    if (constMatch) {
      for (const m of constMatch) {
        const name = m.match(/const\s+([A-Z]\w*)/)?.[1]
        if (name) components.push(name)
      }
    }

    // Deduplicate
    return {
      fileName,
      components: [...new Set(components)]
    }
  } catch (error) {
    return {
      fileName,
      components: []
    }
  }
}
