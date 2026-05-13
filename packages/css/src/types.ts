// ── CSS Variable Manifest ──────────────────────────────────────────

export interface CSSVariable {
  /** Absolute file path where the variable is declared */
  file: string
  /** Line number in the file (1-based) */
  line: number
  /** Column number in the file (1-based) */
  col: number
  /** Variable name including `--` prefix, e.g. `--accent` */
  name: string
  /** Current value, e.g. `#0580aa`, `1200px`, `rgba(0, 0, 0, 0.08)` */
  value: string
  /** Raw value exactly as written in source (before PostCSS normalization) */
  rawValue: string
  /** CSS scope selector, e.g. `:root`, `.dark`, `@media (max-width: 700px)` */
  scope: string
  /** Whether `is:global` (Astro) — affects scoping behavior */
  isGlobal: boolean
  /** Offset of the <style> block within the file (for .astro files) */
  styleBlockOffset: number
}

export type ControlType = "color" | "slider" | "text"

export interface CSSVariableGroup {
  file: string
  scope: string
  variables: CSSVariable[]
}

export interface CSSVariableManifest {
  variables: CSSVariable[]
  files: string[]
  scannedAt: number
}

// ── CSS Rule (for DOM Inspector) ───────────────────────────────────

export interface CSSProperty {
  name: string
  value: string
  line: number
  col: number
}

export interface CSSRule {
  file: string
  selector: string
  properties: CSSProperty[]
}

// ── Patches ────────────────────────────────────────────────────────

export interface CSSVariablePatch {
  action_type: "updateCSSVariable"
  file: string
  variable: {
    name: string
    value: string
    scope: string
  }
  /** Offset of the <style> block within the file (for .astro files) */
  styleBlockOffset: number
}

export interface CSSPropertyPatch {
  action_type: "updateCSSProperty"
  file: string
  property: {
    selector: string
    name: string
    value: string
    line: number
    col: number
  }
  styleBlockOffset: number
}

export interface TextContentPatch {
  action_type: "updateTextContent"
  file: string
  textContent: {
    line: number
    col: number
    oldText: string
    newText: string
  }
}

export type CSSPatch = CSSVariablePatch | CSSPropertyPatch | TextContentPatch

// ── Plugin Options ─────────────────────────────────────────────────

export interface CSSEditorOptions {
  /** Glob patterns for files to scan (default: .css and .astro files) */
  include?: string[]
  /** Glob patterns to exclude (default: node_modules) */
  exclude?: string[]
  /** Root directories to scan (default: ["src"]) */
  scanDirs?: string[]
  /** Keyboard shortcut to toggle the editor (default: "meta+shift+c") */
  shortcut?: string
}

// ── Astro Integration ──────────────────────────────────────────────

export interface AstroIntegration {
  name: string
  hooks: {
    "astro:config:setup": (ctx: {
      updateConfig: (config: any) => void
      command: string
      injectScript: (stage: string, content: string) => void
    }) => void
  }
}
