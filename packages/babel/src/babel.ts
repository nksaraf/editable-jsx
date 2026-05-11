import {
  ConfigAPI,
  NodePath,
  PluginObj,
  types as t,
  template
} from "@babel/core"
import { basename, extname } from "path"
import { JSXElementType } from "./types"

const TRACE_ID = "_source"
const FILE_NAME_VAR = "_jsxFileName"

/**
 * Extract editable string literal parts from a className expression.
 * Given `cn("base-classes", active && "conditional-classes")`, this returns:
 * [
 *   { value: "base-classes", line: 5, column: 8, type: "static" },
 *   { value: "conditional-classes", line: 5, column: 30, type: "conditional" }
 * ]
 */
function extractClassNameParts(
  expr: t.Expression
): Array<{ value: string; line: number; column: number; type: string }> {
  const parts: Array<{
    value: string
    line: number
    column: number
    type: string
  }> = []

  function visit(node: t.Node, context: string) {
    if (t.isStringLiteral(node) && node.loc) {
      parts.push({
        value: node.value,
        line: node.loc.start.line,
        column: node.loc.start.column + 1, // 1-based to match _source convention
        type: context
      })
    } else if (t.isTemplateLiteral(node)) {
      // Template literal: extract the static quasis
      for (const quasi of node.quasis) {
        if (quasi.value.raw.trim() && quasi.loc) {
          parts.push({
            value: quasi.value.raw.trim(),
            line: quasi.loc.start.line,
            column: quasi.loc.start.column + 1,
            type: "template"
          })
        }
      }
    } else if (t.isCallExpression(node)) {
      // cn("base", condition && "conditional") — visit each argument
      for (const arg of node.arguments) {
        if (t.isExpression(arg)) {
          visit(arg, "static")
        }
      }
    } else if (t.isLogicalExpression(node) && node.operator === "&&") {
      // condition && "classes"
      visit(node.right, "conditional")
    } else if (t.isLogicalExpression(node) && node.operator === "||") {
      visit(node.left, "fallback")
      visit(node.right, "fallback")
    } else if (t.isConditionalExpression(node)) {
      // condition ? "a" : "b"
      visit(node.consequent, "conditional")
      visit(node.alternate, "conditional")
    } else if (t.isArrayExpression(node)) {
      // ["base", condition && "conditional"]
      for (const el of node.elements) {
        if (el && t.isExpression(el)) visit(el, "static")
      }
    }
  }

  visit(expr, "static")
  return parts
}

const isSourceAttr = (attr: t.Node) =>
  t.isJSXAttribute(attr) && attr.name.name === TRACE_ID

function getName(v: t.LVal | t.Node | null | undefined): string | null {
  if (!v) return null
  if (t.isIdentifier(v)) return v.name
  // if (t.isObjectPattern(v)) return v.properties.map(getName).join(".")
  // if (t.isArrayPattern(v)) return v.elements.map(getName).join(".")
  if (t.isRestElement(v)) return getName(v.argument)
  if (t.isAssignmentPattern(v)) return getName(v.left)
  return ""
}

function findParentReactComponent(
  path: NodePath
): NodePath<t.FunctionDeclaration | t.VariableDeclarator> {
  let el
  return path.findParent((path) =>
    Boolean(
      (path.isFunctionDeclaration() &&
        path.get("id").isIdentifier() &&
        path.get("id").node?.name.match(/^[A-Z]/)) ||
        (path.isVariableDeclarator() &&
          ((el = path.get("id")), el.isIdentifier()) &&
          el.node?.name.match(/^[A-Z]/))
    )
  ) as any
}

const createNodeFromNullish = <T, N extends t.Node>(
  val: T | null,
  fn: (val: T) => N
): N | t.NullLiteral => (val == null ? t.nullLiteral() : fn(val))

const makeTrace = (
  fileNameIdentifier: t.Identifier,
  { line, column }: { line: number; column: number },
  componentName: string | null,
  moduleName: string,
  elementName: string,
  classNameParts?: Array<{
    value: string
    line: number
    column: number
    type: string
  }>
) => {
  const fileLineLiteral = createNodeFromNullish(line, t.numericLiteral)
  const moduleNameLiteral = createNodeFromNullish(moduleName, t.stringLiteral)
  const componentNameLiteral = createNodeFromNullish(
    componentName,
    t.stringLiteral
  )
  const elementNameLiteral = createNodeFromNullish(elementName, t.stringLiteral)
  const fileColumnLiteral = createNodeFromNullish(column, (c) =>
    // c + 1 to make it 1-based instead of 0-based.
    t.numericLiteral(c + 1)
  )

  const baseProps: any = template.expression.ast`{
      fileName: ${fileNameIdentifier},
      lineNumber: ${fileLineLiteral},
      columnNumber: ${fileColumnLiteral},
      moduleName: ${moduleNameLiteral},
      componentName: ${componentNameLiteral},
      elementName: ${elementNameLiteral}
    }`

  // Add classNameParts if className uses an expression
  if (classNameParts && classNameParts.length > 0) {
    const partsArray = t.arrayExpression(
      classNameParts.map((part) =>
        t.objectExpression([
          t.objectProperty(
            t.identifier("value"),
            t.stringLiteral(part.value)
          ),
          t.objectProperty(
            t.identifier("line"),
            t.numericLiteral(part.line)
          ),
          t.objectProperty(
            t.identifier("column"),
            t.numericLiteral(part.column)
          ),
          t.objectProperty(
            t.identifier("type"),
            t.stringLiteral(part.type)
          )
        ])
      )
    )
    baseProps.properties.push(
      t.objectProperty(t.identifier("classNameParts"), partsArray)
    )
  }

  return baseProps
}

export const reactThreeEditorBabel = (api: ConfigAPI): PluginObj => {
  api.assertVersion(7)
  return {
    name: "react-three-editor-transform",
    visitor: {
      Program: {
        exit(pass, program) {
          const {
            node: { body }
          } = pass
          const importPath = (program.opts as any)["imports"] as {
            path: string
            imports: string[]
          }

          if (!importPath) return

          body.unshift(
            t.importDeclaration(
              importPath.imports.map((i) =>
                t.importSpecifier(t.identifier(i), t.identifier(i))
              ),
              t.stringLiteral(importPath.path)
            )
          )
        }
      },
      ImportDeclaration(path, program) {
        const { node } = path
        const { source } = node
        if ((program.opts as any).replaceImports?.[source.value]) {
          source.value = (program.opts as any).replaceImports?.[source.value]
        }
      },
      JSXOpeningElement(path, state) {
        const { node } = path
        if (
          // the element was generated and doesn't have location information
          !node.loc ||
          // Already has __source
          path.node.attributes.some(isSourceAttr)
        ) {
          return
        }
        const parentComponent = findParentReactComponent(path)

        let componentName = null
        if (parentComponent) {
          componentName = getName(parentComponent.get("id").node)
        }

        let elementName =
          node.name.type === "JSXIdentifier" ? node.name.name : null

        function isEditableElement(el: JSXElementType) {
          let f = (state.opts as any)["isEditable"] as (
            el: JSXElementType
          ) => boolean
          return f(el)
        }

        // Helper to sync the closing element name with the opening element
        const syncClosingElement = (newName: t.JSXIdentifier | t.JSXMemberExpression) => {
          const parent = path.parentPath
          if (parent?.isJSXElement()) {
            const closingElement = parent.node.closingElement
            if (closingElement) {
              closingElement.name = t.cloneNode(newName)
            }
          }
        }

        if (t.isJSXIdentifier(node.name) && node.name.name.match(/^[a-z]/)) {
          let element = node.name

          if (
            isEditableElement({
              type: "primitive",
              name: element.name,
              node: element,
              fileName: state.filename || "",
              openingElement: node
            })
          ) {
            const newName = t.jsxMemberExpression(
              t.jsxIdentifier("editable"),
              t.jsxIdentifier(node.name.name)
            )
            node.name = newName
            syncClosingElement(newName)
          }
        } else if (
          t.isJSXIdentifier(node.name) &&
          node.name.name.match(/^[A-Z]/) &&
          node.name.name !== "Editable"
        ) {
          let element = node.name
          if (
            isEditableElement({
              type: "component",
              name: element.name,
              node: element,
              fileName: state.filename || "",
              openingElement: node
            })
          ) {
            node.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier("__component"),
                t.jsxExpressionContainer(t.identifier(node.name.name))
              )
            )
            const newName = t.jsxIdentifier("Editable")
            node.name = newName
            syncClosingElement(newName)
          }
        } else if (
          t.isJSXMemberExpression(node.name) &&
          t.isJSXIdentifier(node.name.object) &&
          node.name.object.name !== "editable"
        ) {
          if (node.name.property.name.match(/^[a-z]/)) {
            if (
              isEditableElement({
                type: "namespaced-primitive",
                name: node.name.property.name,
                node: node.name.property,
                namespace: node.name.object.name,
                fileName: state.filename || "",
                openingElement: node
              })
            ) {
              node.attributes.push(
                t.jsxAttribute(
                  t.jsxIdentifier("__component"),
                  t.jsxExpressionContainer(
                    t.memberExpression(
                      t.identifier(node.name.object.name),
                      t.identifier(node.name.property.name)
                    )
                  )
                )
              )
              const newName = t.jsxIdentifier("Editable")
              node.name = newName
              syncClosingElement(newName)
            }
          } else if (
            isEditableElement({
              type: "namespaced-component",
              name: node.name.property.name,
              node: node.name.property,
              namespace: node.name.object.name,
              fileName: state.filename || "",
              openingElement: node
            })
          ) {
            node.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier("__component"),
                t.jsxExpressionContainer(
                  t.memberExpression(
                    t.identifier(node.name.object.name),
                    t.identifier(node.name.property.name)
                  )
                )
              )
            )
            const newName = t.jsxIdentifier("Editable")
            node.name = newName
            syncClosingElement(newName)
          }
        }

        if (!state.fileNameIdentifier) {
          const fileNameId = path.scope.generateUidIdentifier(FILE_NAME_VAR)
          state.fileNameIdentifier = fileNameId

          path.scope.getProgramParent().push({
            id: fileNameId,
            init: t.stringLiteral(state.filename || "")
          })
        }

        // Extract className expression parts if className is a JSX expression (not a simple string)
        let classNameParts: ReturnType<typeof extractClassNameParts> | undefined
        const classNameAttr = node.attributes.find(
          (attr): attr is t.JSXAttribute =>
            t.isJSXAttribute(attr) && attr.name.name === "className"
        )
        if (
          classNameAttr?.value &&
          t.isJSXExpressionContainer(classNameAttr.value) &&
          t.isExpression(classNameAttr.value.expression)
        ) {
          classNameParts = extractClassNameParts(classNameAttr.value.expression)
        }

        node.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier(TRACE_ID),
            t.jsxExpressionContainer(
              makeTrace(
                t.cloneNode(state.fileNameIdentifier as t.Identifier),
                node.loc.start,
                componentName ?? null,
                basename(state.filename!, extname(state.filename!)),
                elementName!,
                classNameParts
              )
            )
          )
        )
      },
      CallExpression(path, state) {
        // check if we are calling `useFrame` and replace it with `useEditorFrame` and use the name of the parent component as the first argument

        const { node } = path
        if (
          t.isIdentifier(node.callee) &&
          node.callee.name === "useFrame" &&
          node.arguments.length === 1
        ) {
          const parentComponent = findParentReactComponent(path)

          if (parentComponent) {
            const componentName = getName(parentComponent.get("id").node)
            parentComponent.state = parentComponent.state?.["count"]
              ? { count: parentComponent.state?.["count"] + 1 }
              : { count: 0 }

            node.arguments.unshift(
              t.stringLiteral(
                componentName + ":" + parentComponent.state["count"]
              )
            )
            node.callee.name = "useEditorFrame"
          }
        } else if (
          t.isIdentifier(node.callee) &&
          node.callee.name === "useUpdate"
        ) {
          const parentComponent = findParentReactComponent(path)

          if (parentComponent) {
            const componentName = getName(parentComponent.get("id").node)
            parentComponent.state = parentComponent.state?.["count"]
              ? { count: parentComponent.state?.["count"] + 1 }
              : { count: 0 }

            node.arguments.unshift(
              t.stringLiteral(
                componentName + ":" + parentComponent.state["count"]
              )
            )
            node.callee.name = "useEditorUpdate"
          }
        }
      }
    }
  }
}
