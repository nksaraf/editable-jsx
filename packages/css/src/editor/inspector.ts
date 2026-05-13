/**
 * CSS Inspector — examines the computed and authored styles
 * of a selected DOM element.
 *
 * Uses the CSSOM API (document.styleSheets) to trace styles
 * back to their source rules and stylesheets.
 */

export interface InspectedRule {
  /** CSS selector text */
  selector: string
  /** Source stylesheet href (null for inline styles) */
  source: string | null
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
      source: null,
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
        source: rule.source,
        properties: props,
      })
    }
  }

  return rules
}

interface MatchedRule {
  rule: CSSStyleRule
  source: string | null
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
      const source = sheet.href || sheet.ownerNode?.textContent?.slice(0, 50) || null

      try {
        const rules = sheet.cssRules || sheet.rules
        if (!rules) continue

        collectMatchingRules(rules, el, source, matched)
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
  source: string | null,
  matched: MatchedRule[],
): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]

    if (rule instanceof CSSStyleRule) {
      try {
        if (el.matches(rule.selectorText)) {
          matched.push({
            rule,
            source,
            specificity: calculateSpecificity(rule.selectorText),
          })
        }
      } catch {
        // Invalid selector
      }
    } else if (rule instanceof CSSMediaRule) {
      if (window.matchMedia(rule.conditionText).matches) {
        collectMatchingRules(rule.cssRules, el, source, matched)
      }
    } else if (rule instanceof CSSLayerBlockRule) {
      collectMatchingRules(rule.cssRules, el, source, matched)
    } else if ("cssRules" in rule && (rule as any).cssRules) {
      collectMatchingRules((rule as any).cssRules, el, source, matched)
    }
  }
}

/**
 * Rough specificity calculation for sorting rules.
 * Returns a numeric score (higher = more specific).
 *
 * This is a simplified version — full CSS specificity calculation
 * is complex, but this is good enough for display ordering.
 */
function calculateSpecificity(selector: string): number {
  let ids = 0
  let classes = 0
  let elements = 0

  // Count IDs (#id)
  const idMatches = selector.match(/#[a-zA-Z_-][\w-]*/g)
  if (idMatches) ids = idMatches.length

  // Count classes, attributes, pseudo-classes (.class, [attr], :pseudo)
  const classMatches = selector.match(
    /\.[a-zA-Z_-][\w-]*|\[[\w-]|:(?!:)[a-zA-Z_-][\w-]*/g,
  )
  if (classMatches) classes = classMatches.length

  // Count elements and pseudo-elements (div, ::before)
  const elemMatches = selector.match(
    /(?:^|[\s+>~])([a-zA-Z][\w-]*)|::[a-zA-Z_-][\w-]*/g,
  )
  if (elemMatches) elements = elemMatches.length

  return ids * 10000 + classes * 100 + elements
}

/**
 * Render the inspector view for a selected element.
 */
export function renderInspector(
  container: HTMLElement,
  el: Element,
  onPropertyChange: (
    selector: string,
    property: string,
    value: string,
    source: string | null,
  ) => void,
): void {
  container.textContent = ""

  // Element info
  const info = document.createElement("div")
  info.className = "selected-element-info"

  const tag = document.createElement("span")
  tag.className = "element-tag"
  const tagName = el.tagName.toLowerCase()
  const idStr = el.id ? `#${el.id}` : ""
  tag.textContent = `<${tagName}${idStr}>`
  info.appendChild(tag)

  if (el.className) {
    const classes = document.createElement("div")
    classes.className = "element-classes"
    classes.textContent = `.${String(el.className).split(/\s+/).filter(Boolean).join(" .")}`
    info.appendChild(classes)
  }

  container.appendChild(info)

  // Inspect
  const rules = inspectElement(el)

  if (rules.length === 0) {
    const empty = document.createElement("div")
    empty.className = "empty-state"
    const p = document.createElement("p")
    p.textContent = "No CSS rules match this element"
    empty.appendChild(p)
    container.appendChild(empty)
    return
  }

  for (const rule of rules) {
    const section = document.createElement("div")
    section.className = "rule-section"

    const selectorEl = document.createElement("div")
    selectorEl.className = "rule-selector"
    selectorEl.textContent = rule.selector

    if (rule.source) {
      const sourceLabel = document.createElement("div")
      sourceLabel.className = "rule-header"
      // Clean up source path for display
      let displaySource = rule.source
      if (displaySource.startsWith("http")) {
        try {
          const url = new URL(displaySource)
          displaySource = url.pathname
        } catch {
          // Use as-is
        }
      }
      sourceLabel.textContent = displaySource
      section.appendChild(sourceLabel)
    }

    section.appendChild(selectorEl)

    for (const prop of rule.properties) {
      const propRow = document.createElement("div")
      propRow.className = "rule-prop"

      const propName = document.createElement("span")
      propName.className = "rule-prop-name"
      propName.textContent = `${prop.name}:`

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
        onPropertyChange(
          rule.selector,
          prop.name,
          propValue.value,
          rule.source,
        )
      })

      propRow.appendChild(propName)
      propRow.appendChild(propValue)
      section.appendChild(propRow)
    }

    container.appendChild(section)
  }
}
