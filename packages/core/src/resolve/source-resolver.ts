/**
 * SourceResolver — canonical "DOM element → source file + position" resolution.
 *
 * One module, one interface, one fallback chain. Every framework registers
 * its strategies here instead of implementing its own resolution logic.
 *
 * Strategies are tried in priority order until one succeeds:
 * 1. data-editable-* attributes (our annotation transform)
 * 2. data-astro-source-* attributes (Astro's native dev toolbar)
 * 3. data-astro-cid-* → stylesheet → data-vite-dev-id (CID tracing)
 * 4. Framework-specific strategies (registered by adapters)
 *
 * New frameworks (Vue, Svelte) register a strategy once and
 * get source resolution for free.
 */

import type { SourceLocation } from "../types.js"

/**
 * Resolved source information for a DOM element.
 */
export interface ResolvedSource extends SourceLocation {
  /** Human-readable label (e.g., "src/pages/index.astro") */
  label: string
  /** How the source was resolved */
  strategy: string
}

/**
 * A strategy for resolving source location from a DOM element.
 * Returns null if it can't resolve.
 */
export interface SourceStrategy {
  /** Strategy name for debugging */
  name: string
  /** Priority (lower = tried first) */
  priority: number
  /** Attempt to resolve source for an element */
  resolve(el: Element): ResolvedSource | null
}

/**
 * Singleton source resolver with pluggable strategies.
 */
class SourceResolverImpl {
  private strategies: SourceStrategy[] = []

  /**
   * Register a source resolution strategy.
   */
  register(strategy: SourceStrategy): void {
    this.strategies.push(strategy)
    this.strategies.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Resolve the source file and position for a DOM element.
   * Tries all strategies in priority order.
   *
   * Also walks up the DOM tree if the exact element has no source.
   */
  resolve(el: Element): ResolvedSource | null {
    // Try the element itself first
    const direct = this.tryResolve(el)
    if (direct) return direct

    // Walk up ancestors
    let current = el.parentElement
    while (current) {
      const resolved = this.tryResolve(current)
      if (resolved) return resolved
      current = current.parentElement
    }

    return null
  }

  private tryResolve(el: Element): ResolvedSource | null {
    for (const strategy of this.strategies) {
      try {
        const result = strategy.resolve(el)
        if (result) return result
      } catch {
        // Strategy failed — try next
      }
    }
    return null
  }
}

/**
 * The global source resolver instance.
 * Strategies are registered at module initialization time.
 */
export const sourceResolver = new SourceResolverImpl()

// ── Built-in strategies ────────────────────────────────────────────

/**
 * Strategy: data-editable-* attributes (injected by our annotation transform)
 */
export const editableAttrsStrategy: SourceStrategy = {
  name: "data-editable",
  priority: 10,
  resolve(el) {
    const file = el.getAttribute("data-editable-file")
    if (!file) return null

    const line = parseInt(el.getAttribute("data-editable-line") || "0", 10)
    const col = parseInt(el.getAttribute("data-editable-col") || "0", 10)
    const label = file.replace(/^.*\/src\//, "src/")

    return { fileName: file, lineNumber: line, columnNumber: col, label, strategy: "data-editable" }
  },
}

/**
 * Strategy: data-astro-source-* attributes (Astro's native dev toolbar)
 */
export const astroSourceStrategy: SourceStrategy = {
  name: "data-astro-source",
  priority: 20,
  resolve(el) {
    const file = el.getAttribute("data-astro-source-file")
    if (!file) return null

    const loc = el.getAttribute("data-astro-source-loc") || ""
    const [line, col] = loc.split(":").map(Number)
    const label = file.replace(/^.*\/src\//, "src/")

    return { fileName: file, lineNumber: line || 0, columnNumber: col || 0, label, strategy: "data-astro-source" }
  },
}

/**
 * Strategy: data-astro-cid-* → stylesheet CSS → data-vite-dev-id
 * Traces the Astro scoping CID through stylesheets to find the source file.
 */
export const astroCidStrategy: SourceStrategy = {
  name: "astro-cid",
  priority: 30,
  resolve(el) {
    // Find the CID attribute on this element or an ancestor
    let cidAttr: string | null = null
    let current: Element | null = el
    while (current) {
      for (const attr of current.attributes) {
        if (attr.name.startsWith("data-astro-cid-")) {
          cidAttr = attr.name
          break
        }
      }
      if (cidAttr) break
      current = current.parentElement
    }
    if (!cidAttr) return null

    // Find the <style> tag whose CSS references this CID
    const cidSelector = `[${cidAttr}]`
    for (const style of document.querySelectorAll("style[data-vite-dev-id]")) {
      if ((style.textContent || "").includes(cidSelector)) {
        const devId = style.getAttribute("data-vite-dev-id")!
        const file = devId.split("?")[0]
        const label = file.replace(/^.*\/src\//, "src/")
        return { fileName: file, lineNumber: 0, columnNumber: 0, label, strategy: "astro-cid" }
      }
    }

    return null
  },
}

/**
 * Strategy: CSS stylesheet data-vite-dev-id (for CSS source files)
 */
export const viteDevIdStrategy: SourceStrategy = {
  name: "vite-dev-id",
  priority: 40,
  resolve(_el) {
    // This strategy works on stylesheets, not elements.
    // Used by the CSS inspector separately.
    return null
  },
}

// Register built-in strategies
sourceResolver.register(editableAttrsStrategy)
sourceResolver.register(astroSourceStrategy)
sourceResolver.register(astroCidStrategy)
