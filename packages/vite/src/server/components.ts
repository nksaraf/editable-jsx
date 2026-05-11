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
      .flatMap((node) => getReactComponents(node))
      .filter(Boolean) as string[]

    return { fileName, components: [...new Set(components)] }
  } catch (error) {
    return { fileName, components: [] }
  }
}

/**
 * Detect exported React components from top-level AST statements.
 * Returns an array because a single `export { A, B, C }` can yield multiple names.
 */
function getReactComponents(node: types.Statement): string[] {
  if (
    !types.isExportDefaultDeclaration(node) &&
    !types.isExportNamedDeclaration(node)
  ) {
    return []
  }

  // export { Foo, Bar } — re-exports: include all PascalCase identifiers
  if (
    types.isExportNamedDeclaration(node) &&
    !node.declaration &&
    node.specifiers.length > 0
  ) {
    const names: string[] = []
    for (const spec of node.specifiers) {
      if (types.isExportSpecifier(spec)) {
        const exported = types.isIdentifier(spec.exported)
          ? spec.exported.name
          : spec.exported.value
        if (/^[A-Z]/.test(exported)) names.push(exported)
      }
    }
    return names
  }

  const decl = node.declaration
  if (!decl) return []

  // export default function Foo() / export function Foo()
  if (types.isFunctionDeclaration(decl) && decl.id) {
    if (/^[A-Z]/.test(decl.id.name) && looksLikeComponent(decl.body)) {
      return [decl.id.name]
    }
  }

  // export default class Foo extends Component / PureComponent
  if (types.isClassDeclaration(decl) && decl.id && /^[A-Z]/.test(decl.id.name)) {
    return [decl.id.name]
  }

  // export const Foo = ...
  if (
    types.isVariableDeclaration(decl) &&
    decl.declarations.length > 0
  ) {
    const varDecl = decl.declarations[0]
    if (!types.isIdentifier(varDecl.id) || !/^[A-Z]/.test(varDecl.id.name)) {
      return []
    }

    const init = varDecl.init
    if (!init) return []

    // export const Foo = () => { ... }
    if (types.isArrowFunctionExpression(init)) {
      if (types.isBlockStatement(init.body)) {
        if (looksLikeComponent(init.body)) return [varDecl.id.name]
      } else if (types.isJSXElement(init.body) || types.isJSXFragment(init.body)) {
        return [varDecl.id.name]
      }
    }

    // export const Foo = function() { ... }
    if (types.isFunctionExpression(init) && looksLikeComponent(init.body)) {
      return [varDecl.id.name]
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
      if (isWrapper) return [varDecl.id.name]
    }
  }

  return []
}

/**
 * Check if a function body looks like a React component by recursively
 * searching for JSX returns or hook calls in any nested block.
 */
function looksLikeComponent(body: types.BlockStatement): boolean {
  return containsComponentSignals(body.body)
}

function containsComponentSignals(stmts: types.Statement[]): boolean {
  for (const stmt of stmts) {
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

    // useXxx() as expression statement
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

    // Recurse into if/else blocks
    if (types.isIfStatement(stmt)) {
      if (
        types.isBlockStatement(stmt.consequent) &&
        containsComponentSignals(stmt.consequent.body)
      ) {
        return true
      }
      if (stmt.alternate) {
        if (
          types.isBlockStatement(stmt.alternate) &&
          containsComponentSignals(stmt.alternate.body)
        ) {
          return true
        }
        // else if chain
        if (types.isIfStatement(stmt.alternate) && containsComponentSignals([stmt.alternate])) {
          return true
        }
      }
    }

    // Recurse into switch cases
    if (types.isSwitchStatement(stmt)) {
      for (const c of stmt.cases) {
        if (containsComponentSignals(c.consequent)) return true
      }
    }

    // Recurse into try/catch/finally
    if (types.isTryStatement(stmt)) {
      if (containsComponentSignals(stmt.block.body)) return true
      if (stmt.handler && containsComponentSignals(stmt.handler.body.body)) return true
      if (stmt.finalizer && containsComponentSignals(stmt.finalizer.body)) return true
    }
  }

  return false
}
