/**
 * Unified Patch Schema — all framework patches are routable through
 * a single discriminated union.
 *
 * The action_type prefix determines which framework handler processes
 * the patch:
 * - "css.*"    → CSS patcher (PostCSS)
 * - "astro.*"  → Astro patcher (@astrojs/compiler)
 * - "jsx.*"    → JSX patcher (ts-morph)
 * - "text.*"   → Text patcher (normalized search)
 *
 * All patches share: action_type + file.
 * Framework-specific data lives in the patch body.
 */

import type { BasePatch } from "../types.js"

// ── CSS Patches ────────────────────────────────────────────────────

export interface CSSVariablePatch extends BasePatch {
  action_type: "css.variable"
  variable: { name: string; value: string; scope: string }
  styleBlockOffset: number
}

export interface CSSPropertyPatch extends BasePatch {
  action_type: "css.property"
  property: { selector: string; name: string; value: string }
}

// ── Text Patches ───────────────────────────────────────────────────

export interface TextPatch extends BasePatch {
  action_type: "text.replace"
  oldText: string
  newText: string
  /** Position hint (0 = use normalized search) */
  line: number
  col: number
}

// ── Astro Patches ──────────────────────────────────────────────────

export interface AstroAttrPatch extends BasePatch {
  action_type: "astro.attribute"
  elementLine: number
  elementCol: number
  attribute: string
  value: string
}

export interface AstroExprPatch extends BasePatch {
  action_type: "astro.expression"
  elementLine: number
  elementCol: number
  attribute: string
  oldLiteral: string
  newLiteral: string
  literalOffset: number
}

// ── JSX Patches ────────────────────────────────────────────────────

export interface JSXAttrPatch extends BasePatch {
  action_type: "jsx.attribute"
  source: { lineNumber: number; columnNumber: number }
  path: string
  value: unknown
}

export interface JSXClassNamePatch extends BasePatch {
  action_type: "jsx.classname"
  source: { lineNumber: number; columnNumber: number }
  partLine: number
  partCol: number
  oldValue: string
  newValue: string
}

// ── Union ──────────────────────────────────────────────────────────

export type Patch =
  | CSSVariablePatch
  | CSSPropertyPatch
  | TextPatch
  | AstroAttrPatch
  | AstroExprPatch
  | JSXAttrPatch
  | JSXClassNamePatch

/**
 * Extract the framework prefix from a patch action_type.
 */
export function patchFramework(patch: Patch): string {
  return patch.action_type.split(".")[0]
}

/**
 * Route patches to framework-specific handlers.
 */
export type PatchRouter = {
  [framework: string]: (file: string, patches: Patch[]) => Promise<void>
}

/**
 * Create a patch dispatcher that routes patches by framework prefix.
 */
export function createPatchDispatcher(router: PatchRouter) {
  return async (file: string, patches: Patch[]): Promise<void> => {
    // Group by framework
    const byFramework = new Map<string, Patch[]>()
    for (const patch of patches) {
      const fw = patchFramework(patch)
      if (!byFramework.has(fw)) byFramework.set(fw, [])
      byFramework.get(fw)!.push(patch)
    }

    // Dispatch to framework handlers sequentially (same file)
    for (const [framework, fwPatches] of byFramework) {
      const handler = router[framework]
      if (!handler) {
        console.warn(`[editable] No handler for patch framework: ${framework}`)
        continue
      }
      await handler(file, fwPatches)
    }
  }
}
