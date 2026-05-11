import { parse, types } from "@babel/core"
import glob from "fast-glob"
import { readFileSync } from "node:fs"

export async function listComponents(componentsDir: string) {
  const componentFiles = await glob(componentsDir, {
    cwd: process.cwd()
  })

  const files = componentFiles.map(listReactComponents)

  return files.filter((f) => f.components.length)
}

function listReactComponents(
  fileName: string
): { fileName: string; components: string[] } {
  try {
    const source = readFileSync(fileName, "utf-8")
    const ast = parse(source, {
      sourceType: "module",
      filename: fileName,
      presets: [
        ["@babel/preset-typescript", { isTSX: true, allExtensions: true }]
      ]
    })

    if (!ast) {
      return { fileName, components: [] }
    }

    const components = ast.program.body
      .map((node) => getReactComponent(node))
      .filter(Boolean) as string[]

    return { fileName, components }
  } catch (error) {
    return { fileName, components: [] }
  }
}

/**
 * Detect exported React components from top-level AST statements.
 *
 * Handles:
 * - export default function FooBar() { return <jsx/> }
 * - export function FooBar() { ... }
 * - export const FooBar = () => { return <jsx/> }
 * - export const FooBar = forwardRef(...)
 * - export const FooBar = memo(...)
 * - export const FooBar = React.memo(...)
 * - export { FooBar }  (named re-exports — by identifier convention)
 * - export default class FooBar extends Component { ... }
 */
function getReactComponent(node: types.Statement): string | undefined {
  if (
    !types.isExportDefaultDeclaration(node) &&
    !types.isExportNamedDeclaration(node)
  ) {
    return
  }

  // export { Foo, Bar } — re-exports: include any PascalCase identifier
  if (
    types.isExportNamedDeclaration(node) &&
    !node.declaration &&
    node.specifiers.length > 0
  ) {
    // Return the first PascalCase export (caller collects all)
    for (const spec of node.specifiers) {
      if (types.isExportSpecifier(spec)) {
        const exported = types.isIdentifier(spec.exported)
          ? spec.exported.name
          : spec.exported.value
        if (/^[A-Z]/.test(exported)) return exported
      }
    }
    return
  }

  const decl = node.declaration
  if (!decl) return

  // export default function Foo() / export function Foo()
  if (types.isFunctionDeclaration(decl) && decl.id) {
    if (/^[A-Z]/.test(decl.id.name) && looksLikeComponent(decl.body)) {
      return decl.id.name
    }
  }

  // export default class Foo extends Component / PureComponent
  if (types.isClassDeclaration(decl) && decl.id && /^[A-Z]/.test(decl.id.name)) {
    return decl.id.name
  }

  // export const Foo = ...
  if (
    types.isVariableDeclaration(decl) &&
    decl.declarations.length > 0
  ) {
    const varDecl = decl.declarations[0]
    if (!types.isIdentifier(varDecl.id) || !/^[A-Z]/.test(varDecl.id.name)) {
      return
    }

    const init = varDecl.init
    if (!init) return

    // export const Foo = () => { ... }
    if (types.isArrowFunctionExpression(init)) {
      if (types.isBlockStatement(init.body)) {
        if (looksLikeComponent(init.body)) return varDecl.id.name
      } else if (types.isJSXElement(init.body) || types.isJSXFragment(init.body)) {
        // export const Foo = () => <div>...</div>
        return varDecl.id.name
      }
    }

    // export const Foo = function() { ... }
    if (types.isFunctionExpression(init) && looksLikeComponent(init.body)) {
      return varDecl.id.name
    }

    // export const Foo = forwardRef(...) / memo(...) / React.memo(...) / React.forwardRef(...)
    if (types.isCallExpression(init)) {
      const callee = init.callee
      const isWrapper =
        (types.isIdentifier(callee) &&
          ["forwardRef", "memo", "lazy"].includes(callee.name)) ||
        (types.isMemberExpression(callee) &&
          types.isIdentifier(callee.object) &&
          callee.object.name === "React" &&
          types.isIdentifier(callee.property) &&
          ["forwardRef", "memo", "lazy"].includes(callee.property.name))
      if (isWrapper) return varDecl.id.name
    }
  }
}

/**
 * Check if a function body looks like a React component:
 * - Returns JSX
 * - Calls hooks (use*)
 */
function looksLikeComponent(body: types.BlockStatement): boolean {
  return body.body.some((stmt) => {
    // return <JSX /> or return (<JSX />)
    if (types.isReturnStatement(stmt)) {
      const arg = stmt.argument
      if (types.isJSXElement(arg) || types.isJSXFragment(arg)) return true
      if (
        types.isParenthesizedExpression(arg) &&
        (types.isJSXElement(arg.expression) || types.isJSXFragment(arg.expression))
      ) {
        return true
      }
    }
    // useXxx() calls
    if (
      types.isExpressionStatement(stmt) &&
      types.isCallExpression(stmt.expression) &&
      types.isIdentifier(stmt.expression.callee) &&
      stmt.expression.callee.name.startsWith("use")
    ) {
      return true
    }
    // const x = useXxx()
    if (
      types.isVariableDeclaration(stmt) &&
      stmt.declarations.some(
        (d) =>
          types.isCallExpression(d.init) &&
          types.isIdentifier(d.init.callee) &&
          d.init.callee.name.startsWith("use")
      )
    ) {
      return true
    }
    return false
  })
}
