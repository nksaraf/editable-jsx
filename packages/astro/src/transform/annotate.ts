/**
 * Astro template annotation transform.
 *
 * Parses an .astro file using @astrojs/compiler, walks all elements
 * and components, and injects data-editable-* attributes with source
 * location metadata. Serializes back to valid .astro source.
 *
 * This is the Astro equivalent of the Babel plugin for JSX that injects
 * `_source` props on every element.
 */
import { parse } from "@astrojs/compiler"
import { is, serialize } from "@astrojs/compiler/utils"
import { ATTRS } from "../types.js"

/**
 * Annotate every element and component in an .astro file with
 * source location attributes.
 *
 * Injected attributes:
 * - data-editable-file     — absolute path to the .astro file
 * - data-editable-line     — 1-based line number of the opening tag
 * - data-editable-col      — 1-based column number
 * - data-editable-element  — tag name (e.g., "div", "h1", "Header")
 * - data-editable-component — Astro component name (for ComponentNode)
 *
 * @param source — raw .astro file content
 * @param filePath — absolute file path
 * @returns annotated .astro source
 */
export async function annotateAstroTemplate(
  source: string,
  filePath: string,
): Promise<string> {
  const { ast } = await parse(source, { position: true })

  // @astrojs/compiler's walk() doesn't recurse deeply enough,
  // so we use our own recursive walker.
  walkDeep(ast, (node: any) => {
    if (is.element(node)) {
      injectSourceAttrs(node, filePath, node.name, null)
    } else if (is.component(node)) {
      injectSourceAttrs(node, filePath, node.name, node.name)
    } else if (is.customElement(node)) {
      injectSourceAttrs(node, filePath, node.name, null)
    }
  })

  return serialize(ast)
}

/**
 * Inject data-editable-* attributes onto an AST node.
 */
function injectSourceAttrs(
  node: any,
  filePath: string,
  elementName: string,
  componentName: string | null,
): void {
  if (!node.position?.start) return
  if (!node.attributes) node.attributes = []

  // Don't double-annotate
  if (node.attributes.some((a: any) => a.name === ATTRS.sourceFile)) return

  const { line, column } = node.position.start

  node.attributes.push(
    makeAttr(ATTRS.sourceFile, filePath),
    makeAttr(ATTRS.line, String(line)),
    makeAttr(ATTRS.col, String(column)),
    makeAttr(ATTRS.element, elementName),
  )

  if (componentName) {
    node.attributes.push(makeAttr(ATTRS.component, componentName))
  }
}

/**
 * Recursively walk all nodes in the AST.
 * @astrojs/compiler's built-in walk() only visits one level deep.
 */
function walkDeep(node: any, callback: (node: any) => void): void {
  callback(node)
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkDeep(child, callback)
    }
  }
}

/**
 * Create an AST AttributeNode.
 * The `raw` field must include the quotes for serialize() to output correctly.
 */
function makeAttr(
  name: string,
  value: string,
): { type: string; kind: string; name: string; value: string; raw: string } {
  return { type: "attribute", kind: "quoted", name, value, raw: `"${value}"` }
}
