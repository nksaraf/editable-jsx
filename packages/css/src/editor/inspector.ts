/**
 * CSS Inspector — examines the computed and authored styles
 * of a selected DOM element.
 *
 * Uses the CSSOM API (document.styleSheets) to trace styles
 * back to their source rules and stylesheets.
 *
 * Source mapping: In Vite dev mode, `<style>` tags have a
 * `data-vite-dev-id` attribute containing the absolute source file path.
 * We use this to trace CSS rules back to source files for save-to-source.
 */

import type {
  CSSPatch,
  CSSPropertyPatch,
  CSSVariablePatch,
  TextContentPatch,
} from "../types.js"
import {
  createColorControl,
  createSliderControl,
  createTextControl,
  inferControlType,
  isColorValue,
  toHexColor,
} from "./controls.js"

export interface InspectedRule {
  /** CSS selector text */
  selector: string
  /** Source file path (resolved from data-vite-dev-id or stylesheet href) */
  sourceFile: string | null
  /** Display label for the source */
  sourceLabel: string | null
  /** Properties in this rule */
  properties: InspectedProperty[]
}

export interface InspectedProperty {
  name: string
  value: string
  /** Whether this property is overridden by a higher-specificity rule */
  overridden: boolean
  /** Whether this is an inline style */
  isInline: boolean
}

/**
 * Resolve the source file path for a stylesheet.
 *
 * Vite dev mode injects `<style>` tags with `data-vite-dev-id`
 * containing the absolute source file path. For linked stylesheets,
 * the href contains the Vite-transformed path.
 */
function resolveSourceFile(sheet: CSSStyleSheet): {
  file: string | null
  label: string | null
} {
  const owner = sheet.ownerNode as HTMLElement | null

  // Vite dev: <style data-vite-dev-id="/abs/path/to/file.css">
  if (owner?.hasAttribute("data-vite-dev-id")) {
    const devId = owner.getAttribute("data-vite-dev-id")!
    // devId may look like "/abs/path/file.css" or "/abs/path/file.astro?astro&type=style..."
    const filePath = devId.split("?")[0]
    const label = filePath.replace(/^.*\/src\//, "src/")
    return { file: filePath, label }
  }

  // Linked stylesheet: <link href="/src/styles/tokens.css">
  if (sheet.href) {
    try {
      const url = new URL(sheet.href)
      // Vite serves source files at their original paths
      const pathname = url.pathname
      // Strip /@fs/ prefix if present
      const filePath = pathname.startsWith("/@fs/")
        ? pathname.slice(4)
        : pathname
      const label = filePath.replace(/^.*\/src\//, "src/")
      return { file: filePath, label }
    } catch {
      return { file: null, label: sheet.href }
    }
  }

  return { file: null, label: null }
}

/**
 * Inspect a DOM element and return all CSS rules that apply to it,
 * along with their properties and source information.
 */
export function inspectElement(el: Element): InspectedRule[] {
  const rules: InspectedRule[] = []

  // 1. Inline styles first (highest specificity)
  const inlineStyle = (el as HTMLElement).style
  if (inlineStyle && inlineStyle.length > 0) {
    const props: InspectedProperty[] = []
    for (let i = 0; i < inlineStyle.length; i++) {
      const name = inlineStyle[i]
      props.push({
        name,
        value: inlineStyle.getPropertyValue(name),
        overridden: false,
        isInline: true,
      })
    }
    rules.push({
      selector: "element.style",
      sourceFile: null,
      sourceLabel: null,
      properties: props,
    })
  }

  // 2. Walk all stylesheets for matching rules
  const matchingRules = getMatchingCSSRules(el)
  const seenProperties = new Set<string>(
    rules[0]?.properties.map((p) => p.name) ?? [],
  )

  for (const rule of matchingRules) {
    const props: InspectedProperty[] = []
    const style = rule.rule.style

    for (let i = 0; i < style.length; i++) {
      const name = style[i]
      const value = style.getPropertyValue(name)
      const overridden = seenProperties.has(name)

      props.push({
        name,
        value,
        overridden,
        isInline: false,
      })

      if (!overridden) {
        seenProperties.add(name)
      }
    }

    if (props.length > 0) {
      rules.push({
        selector: rule.rule.selectorText,
        sourceFile: rule.sourceFile,
        sourceLabel: rule.sourceLabel,
        properties: props,
      })
    }
  }

  return rules
}

interface MatchedRule {
  rule: CSSStyleRule
  sourceFile: string | null
  sourceLabel: string | null
  specificity: number
}

/**
 * Get all CSS rules that match the given element,
 * sorted by specificity (highest first).
 */
function getMatchingCSSRules(el: Element): MatchedRule[] {
  const matched: MatchedRule[] = []

  try {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i]
      const { file, label } = resolveSourceFile(sheet)

      try {
        const rules = sheet.cssRules || sheet.rules
        if (!rules) continue

        collectMatchingRules(rules, el, file, label, matched)
      } catch {
        // CORS may prevent reading cross-origin stylesheets
        continue
      }
    }
  } catch {
    // Ignore errors
  }

  // Sort by specificity (highest first, after inline styles)
  matched.sort((a, b) => b.specificity - a.specificity)
  return matched
}

/**
 * Recursively collect matching rules (handles @media, @layer, etc.)
 */
function collectMatchingRules(
  rules: CSSRuleList,
  el: Element,
  sourceFile: string | null,
  sourceLabel: string | null,
  matched: MatchedRule[],
): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]

    if (rule instanceof CSSStyleRule) {
      try {
        if (el.matches(rule.selectorText)) {
          matched.push({
            rule,
            sourceFile,
            sourceLabel,
            specificity: calculateSpecificity(rule.selectorText),
          })
        }
      } catch {
        // Invalid selector
      }
    } else if (rule instanceof CSSMediaRule) {
      if (window.matchMedia(rule.conditionText).matches) {
        collectMatchingRules(rule.cssRules, el, sourceFile, sourceLabel, matched)
      }
    } else if (rule instanceof CSSLayerBlockRule) {
      collectMatchingRules(rule.cssRules, el, sourceFile, sourceLabel, matched)
    } else if ("cssRules" in rule && (rule as any).cssRules) {
      collectMatchingRules(
        (rule as any).cssRules,
        el,
        sourceFile,
        sourceLabel,
        matched,
      )
    }
  }
}

/**
 * Rough specificity calculation for sorting rules.
 */
function calculateSpecificity(selector: string): number {
  let ids = 0
  let classes = 0
  let elements = 0

  const idMatches = selector.match(/#[a-zA-Z_-][\w-]*/g)
  if (idMatches) ids = idMatches.length

  const classMatches = selector.match(
    /\.[a-zA-Z_-][\w-]*|\[[\w-]|:(?!:)[a-zA-Z_-][\w-]*/g,
  )
  if (classMatches) classes = classMatches.length

  const elemMatches = selector.match(
    /(?:^|[\s+>~])([a-zA-Z][\w-]*)|::[a-zA-Z_-][\w-]*/g,
  )
  if (elemMatches) elements = elemMatches.length

  return ids * 10000 + classes * 100 + elements
}

// ── Pending changes tracker ────────────────────────────────────────

export interface PendingPropertyChange {
  selector: string
  property: string
  value: string
  sourceFile: string
}

/**
 * Render the inspector view for a selected element.
 *
 * Features:
 * - Shows all matching CSS rules grouped by source file
 * - Editable property values with live preview
 * - Color swatches for color values
 * - "Edit text" button for text content
 * - Save button that writes changes back to source CSS files
 * - "Pick new" button to re-enter pick mode
 */
/**
 * Extract CSS variable name from a `var(--xxx)` or `var(--xxx, fallback)` value.
 * Returns null if the value doesn't reference a CSS variable.
 */
function extractVarReference(value: string): string | null {
  const match = value.match(/var\(\s*(--[\w-]+)/)
  return match ? match[1] : null
}

/**
 * Resolve a CSS variable to its current computed value.
 */
function resolveVariable(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

/**
 * Find the source file and scope for a CSS variable by scanning stylesheets.
 */
function findVariableSource(varName: string): {
  file: string | null
  scope: string
} | null {
  for (let i = 0; i < document.styleSheets.length; i++) {
    const sheet = document.styleSheets[i]
    const owner = sheet.ownerNode as HTMLElement | null
    const devId = owner?.getAttribute?.("data-vite-dev-id")
    const file = devId ? devId.split("?")[0] : null

    try {
      const rules = sheet.cssRules
      if (!rules) continue

      const result = findVarInRules(rules, varName)
      if (result) return { file, scope: result }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Recursively search CSS rules for a variable declaration.
 * Returns the selector/scope string if found, null otherwise.
 */
function findVarInRules(rules: CSSRuleList, varName: string): string | null {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]

    if (rule instanceof CSSStyleRule) {
      for (let k = 0; k < rule.style.length; k++) {
        if (rule.style[k] === varName) {
          return rule.selectorText
        }
      }
    } else if (
      rule instanceof CSSMediaRule ||
      rule instanceof CSSLayerBlockRule ||
      ("cssRules" in rule && (rule as any).cssRules)
    ) {
      const nested = findVarInRules(
        (rule as CSSGroupingRule).cssRules,
        varName,
      )
      if (nested) return nested
    }
  }
  return null
}

export function renderInspector(
  container: HTMLElement,
  el: Element,
  onSave: (patches: CSSPatch[]) => void,
  onPickNew: () => void,
): void {
  container.textContent = ""

  const pendingChanges: PendingPropertyChange[] = []
  const pendingVarChanges: Map<
    string,
    { name: string; value: string; file: string; scope: string }
  > = new Map()

  // ── Element info bar ───────────────────────────────────
  const info = document.createElement("div")
  info.className = "selected-element-info"

  const infoRow = document.createElement("div")
  infoRow.style.cssText = "display:flex;justify-content:space-between;align-items:center"

  const tagInfo = document.createElement("div")
  const tag = document.createElement("span")
  tag.className = "element-tag"
  const tagName = el.tagName.toLowerCase()
  const idStr = el.id ? `#${el.id}` : ""
  tag.textContent = `<${tagName}${idStr}>`
  tagInfo.appendChild(tag)

  if (el.className && typeof el.className === "string") {
    const classes = document.createElement("div")
    classes.className = "element-classes"
    classes.textContent = `.${el.className.split(/\s+/).filter(Boolean).join(" .")}`
    tagInfo.appendChild(classes)
  }

  const pickBtn = document.createElement("button")
  pickBtn.className = "btn btn-secondary"
  pickBtn.textContent = "Pick new"
  pickBtn.style.cssText = "padding:3px 8px;font-size:11px"
  pickBtn.addEventListener("click", onPickNew)

  infoRow.appendChild(tagInfo)
  infoRow.appendChild(pickBtn)
  info.appendChild(infoRow)

  // ── Text content editing ───────────────────────────────
  const textContent = getDirectTextContent(el)
  if (textContent.trim()) {
    const textSection = document.createElement("div")
    textSection.style.cssText = "margin-top:8px;border-top:1px solid #334155;padding-top:8px"

    const textLabel = document.createElement("div")
    textLabel.className = "rule-header"
    textLabel.textContent = "TEXT CONTENT"
    textSection.appendChild(textLabel)

    const textInput = document.createElement("textarea")
    textInput.className = "text-edit-input"
    textInput.value = textContent.trim()
    textInput.rows = Math.min(4, textContent.trim().split("\n").length + 1)

    const originalText = textContent.trim()
    textInput.addEventListener("input", () => {
      // Live preview
      setDirectTextContent(el, textInput.value)
    })

    textSection.appendChild(textInput)
    info.appendChild(textSection)

    // Track text change for save
    textInput.addEventListener("change", () => {
      if (textInput.value !== originalText) {
        // We'll handle text save separately
        ;(textInput as any).__originalText = originalText
        ;(textInput as any).__changed = true
      }
    })

    // Store reference for save
    ;(info as any).__textInput = textInput
    ;(info as any).__textOriginal = originalText
  }

  container.appendChild(info)

  // ── CSS Rules ──────────────────────────────────────────
  const rules = inspectElement(el)

  if (rules.length === 0) {
    const empty = document.createElement("div")
    empty.className = "empty-state"
    const p = document.createElement("p")
    p.textContent = "No CSS rules match this element"
    empty.appendChild(p)
    container.appendChild(empty)
  }

  for (const rule of rules) {
    const section = document.createElement("div")
    section.className = "rule-section"

    // Source file label
    if (rule.sourceLabel) {
      const sourceLabel = document.createElement("div")
      sourceLabel.className = "rule-header"
      sourceLabel.textContent = rule.sourceLabel
      section.appendChild(sourceLabel)
    }

    // Selector
    const selectorEl = document.createElement("div")
    selectorEl.className = "rule-selector"
    selectorEl.textContent = rule.selector
    section.appendChild(selectorEl)

    // Properties
    for (const prop of rule.properties) {
      const propRow = document.createElement("div")
      propRow.className = "rule-prop"

      const propName = document.createElement("span")
      propName.className = "rule-prop-name"
      propName.textContent = `${prop.name}:`
      propRow.appendChild(propName)

      // ── Check for var(--xxx) references ──────────────
      const varRef = extractVarReference(prop.value)

      if (varRef && !prop.overridden) {
        // This property uses a CSS variable — render an inline variable editor
        const resolvedValue = resolveVariable(varRef)
        const varSource = findVariableSource(varRef)

        const varContainer = document.createElement("div")
        varContainer.className = "var-control"
        varContainer.style.cssText = "flex:1;min-width:0"

        // Variable chip — shows --var-name as a clickable badge
        const varChip = document.createElement("button")
        varChip.className = "var-chip"
        varChip.textContent = varRef
        varChip.title = `${prop.value} → ${resolvedValue}`

        // Resolved value swatch (for colors)
        if (isColorValue(resolvedValue)) {
          const swatch = document.createElement("div")
          swatch.style.cssText = `width:14px;height:14px;border-radius:3px;border:1px solid #334155;flex-shrink:0;background:${resolvedValue}`
          propRow.appendChild(swatch)
        }

        propRow.appendChild(varChip)

        // Inline editor — initially hidden, opens on chip click
        const inlineEditor = document.createElement("div")
        inlineEditor.className = "var-inline-editor"
        inlineEditor.style.display = "none"

        const control = createControlForValue(varRef, resolvedValue, (newValue) => {
          // Live preview — update the CSS variable globally
          document.documentElement.style.setProperty(varRef, newValue)

          // Update swatch
          const sw = propRow.querySelector("div[style*=background]") as HTMLElement
          if (sw) sw.style.background = newValue

          // Track as variable change (not property change)
          if (varSource?.file) {
            pendingVarChanges.set(varRef, {
              name: varRef,
              value: newValue,
              file: varSource.file,
              scope: varSource.scope,
            })
          }
        })
        inlineEditor.appendChild(control)

        // Toggle inline editor on chip click
        varChip.addEventListener("click", (e) => {
          e.stopPropagation()
          const isOpen = inlineEditor.style.display !== "none"
          inlineEditor.style.display = isOpen ? "none" : ""
          varChip.classList.toggle("active", !isOpen)
        })

        // Source file hint under the editor
        if (varSource?.file) {
          const sourceHint = document.createElement("div")
          sourceHint.style.cssText =
            "font-size:10px;color:#475569;margin-top:2px;font-family:ui-monospace,monospace"
          sourceHint.textContent = `${varSource.file.replace(/^.*\/src\//, "src/")} → ${varSource.scope}`
          inlineEditor.appendChild(sourceHint)
        }

        propRow.appendChild(inlineEditor)
      } else {
        // Regular property — plain text input

        // Color swatch for resolved color values
        if (isColorValue(prop.value)) {
          const swatch = document.createElement("div")
          swatch.style.cssText = `width:14px;height:14px;border-radius:3px;border:1px solid #334155;flex-shrink:0;background:${prop.value}`
          propRow.appendChild(swatch)
        }

        const propValue = document.createElement("input")
        propValue.className = "var-input"
        propValue.style.fontSize = "11px"
        propValue.value = prop.value
        if (prop.overridden) {
          propValue.style.textDecoration = "line-through"
          propValue.style.color = "#475569"
        }

        propValue.addEventListener("change", () => {
          // Live preview
          ;(el as HTMLElement).style.setProperty(prop.name, propValue.value)

          // Track as pending change
          if (rule.sourceFile) {
            const existing = pendingChanges.findIndex(
              (c) => c.selector === rule.selector && c.property === prop.name,
            )
            if (existing !== -1) pendingChanges.splice(existing, 1)

            pendingChanges.push({
              selector: rule.selector,
              property: prop.name,
              value: propValue.value,
              sourceFile: rule.sourceFile,
            })
          }

          // Update swatch if color
          const swatch = propRow.querySelector(
            "div[style*=background]",
          ) as HTMLElement
          if (swatch) swatch.style.background = propValue.value
        })

        propRow.appendChild(propValue)
      }

      section.appendChild(propRow)
    }

    container.appendChild(section)
  }

  // ── Save bar ───────────────────────────────────────────
  const saveBar = document.createElement("div")
  saveBar.className = "panel-footer"

  const saveInfo = document.createElement("span")
  saveInfo.className = "footer-info"
  saveInfo.textContent = `${rules.length} rules`

  const saveActions = document.createElement("div")
  saveActions.className = "footer-actions"

  const saveBtn = document.createElement("button")
  saveBtn.className = "btn btn-primary"
  saveBtn.textContent = "Save to source"
  saveBtn.addEventListener("click", () => {
    const patches: CSSPatch[] = []

    // CSS property patches
    for (const change of pendingChanges) {
      // Strip Astro scoping from selector for source matching
      const cleanSelector = change.selector.replace(
        /\[data-astro-cid-[a-z0-9]+\]/g,
        "",
      )

      // Resolve source file — strip ?astro&type=style params
      const sourceFile = change.sourceFile.split("?")[0]

      const patch: CSSPropertyPatch = {
        action_type: "updateCSSProperty",
        file: sourceFile,
        property: {
          selector: cleanSelector,
          name: change.property,
          value: change.value,
          line: 0, // PostCSS will find by selector+property name
          col: 0,
        },
        styleBlockOffset: 0,
      }
      patches.push(patch)
    }

    // CSS variable patches (from inline var editors)
    for (const [, change] of pendingVarChanges) {
      const patch: CSSVariablePatch = {
        action_type: "updateCSSVariable",
        file: change.file,
        variable: {
          name: change.name,
          value: change.value,
          scope: change.scope,
        },
        styleBlockOffset: 0,
      }
      patches.push(patch)
    }

    // Text content patch
    const textInput = (info as any).__textInput as HTMLTextAreaElement | undefined
    const originalText = (info as any).__textOriginal as string | undefined
    if (textInput && originalText && textInput.value !== originalText) {
      // We need the source file for this element
      // Use data-astro-source-file if available, otherwise we can't save text
      const sourceAttr =
        el.getAttribute("data-astro-source-file") ||
        el.closest("[data-astro-source-file]")?.getAttribute("data-astro-source-file")

      if (sourceAttr) {
        const locAttr =
          el.getAttribute("data-astro-source-loc") ||
          el.closest("[data-astro-source-loc]")?.getAttribute("data-astro-source-loc")
        const [line, col] = locAttr ? locAttr.split(":").map(Number) : [0, 0]

        const patch: TextContentPatch = {
          action_type: "updateTextContent",
          file: sourceAttr,
          textContent: {
            line: line || 0,
            col: col || 0,
            oldText: originalText,
            newText: textInput.value,
          },
        }
        patches.push(patch)
      }
    }

    if (patches.length > 0) {
      onSave(patches)
    }
  })

  saveActions.appendChild(saveBtn)
  saveBar.appendChild(saveInfo)
  saveBar.appendChild(saveActions)
  container.appendChild(saveBar)
}

// ── Variable control helpers ───────────────────────────────────────

/**
 * Create the appropriate control for a CSS variable value.
 * Detects colors, numeric values, and falls back to text input.
 */
function createControlForValue(
  name: string,
  value: string,
  onChange: (newValue: string) => void,
): HTMLElement {
  const type = inferControlType(name, value)
  switch (type) {
    case "color":
      return createColorControl(value, onChange)
    case "slider":
      return createSliderControl(value, onChange)
    default:
      return createTextControl(value, onChange)
  }
}

// ── Text content helpers ───────────────────────────────────────────

/**
 * Get the direct text content of an element (excluding child elements).
 */
function getDirectTextContent(el: Element): string {
  let text = ""
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ""
    }
  }
  return text
}

/**
 * Set the direct text content of an element (preserving child elements).
 */
function setDirectTextContent(el: Element, text: string): void {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = text
      return
    }
  }
  // No text node found — prepend one
  el.insertBefore(document.createTextNode(text), el.firstChild)
}
