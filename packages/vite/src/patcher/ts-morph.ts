import { EditPatch } from "@editable-jsx/state"
import { Node, Project, SourceFile, SyntaxKind } from "ts-morph"

export const tsProject = new Project({
  tsConfigFilePath: "tsconfig.json"
})

function isPos(el: Node, pos: { lineNumber: number; columnNumber: number }) {
  // console.log(
  //   el.getStartLineNumber(),
  //   el.getFullStart() - el.StartLin() + 1,
  //   pos.lineNumber,
  //   pos.columnNumber
  // )
  // debugger
  return (
    el.getStartLineNumber() === pos.lineNumber &&
    el.getStart() - el.getStartLinePos() + 1 === pos.columnNumber
  )
}

let findElement = (
  sourceFile: SourceFile,
  pos: { lineNumber: number; columnNumber: number }
) => {
  // for (let x of sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement)) {
  //   if (isPos(x, pos)) {
  //     return x
  //   }
  // }

  for (let x of sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)) {
    if (isPos(x, pos)) {
      return x
    }
  }

  for (let x of sourceFile.getDescendantsOfKind(
    SyntaxKind.JsxSelfClosingElement
  )) {
    if (isPos(x, pos)) {
      return x
    }
  }
}

const valueExpression = (value: any) => {
  if (typeof value.expression === "string") {
    // const templ = template(value.expression)
    // const ast = templ({})
    // if (types.isExpressionStatement(ast)) {
    //   return types.jsxExpressionContainer(ast.expression)
    // }
  } else if (Array.isArray(value)) {
    return `{[${value.join(", ")}]}`
  }
  if (typeof value === "string") {
    return `"${value}"`
  } else if (typeof value === "number") {
    return `{${value}}`
  } else if (typeof value === "boolean") {
    return `{${value}}`
  }
}

function setAttribute(
  el: Exclude<ReturnType<typeof findElement>, undefined>,
  propPath: string,
  propValue: any
) {
  // Find existing attribute
  const existing = el
    .getDescendantsOfKind(SyntaxKind.JsxAttribute)
    .find((a) => a.compilerNode.name.text === propPath)

  if (existing) {
    // Update existing attribute
    if (typeof propValue === "object" && !Array.isArray(propValue)) {
      existing
        .getInitializer()!
        .replaceWithText(`{${JSON.stringify(propValue)}}`)
    } else {
      const propValueString = valueExpression(propValue)
      if (!propValueString) {
        throw new Error(`Could not serialize prop value for "${propPath}"`)
      }
      existing.getInitializer()!.replaceWithText(`${propValueString}`)
    }
  } else {
    // Add new attribute (handles elements that didn't have this prop)
    const propValueString = valueExpression(propValue)
    if (propValueString) {
      el.addAttribute({
        name: propPath,
        initializer: propValueString
      })
    }
  }
}

/**
 * Modify a specific string literal within a className expression.
 * Used when className is `cn("base", active && "conditional")` — we need to
 * find the exact StringLiteral at the given position and replace its content.
 */
function setClassNamePart(
  sourceFile: SourceFile,
  partLine: number,
  partColumn: number,
  newValue: string
) {
  // Find the string literal at the given position
  for (const literal of sourceFile.getDescendantsOfKind(
    SyntaxKind.StringLiteral
  )) {
    if (isPos(literal, { lineNumber: partLine, columnNumber: partColumn })) {
      literal.replaceWithText(`"${newValue}"`)
      return true
    }
  }

  // Also check template literal spans (quasis)
  for (const template of sourceFile.getDescendantsOfKind(
    SyntaxKind.TemplateExpression
  )) {
    const head = template.getHead()
    if (
      isPos(head, { lineNumber: partLine, columnNumber: partColumn })
    ) {
      // Replace just the head text of the template
      head.replaceWithText("`" + newValue)
      return true
    }
    for (const span of template.getTemplateSpans()) {
      const literal = span.getLiteral()
      if (
        isPos(literal, { lineNumber: partLine, columnNumber: partColumn })
      ) {
        literal.replaceWithText(newValue + "`")
        return true
      }
    }
  }

  return false
}

export async function tsMorphPatcher(
  fileName: string,
  code: string,
  patches: EditPatch<{}>[]
) {
  let sourceFile: SourceFile
  if ((sourceFile = tsProject.getSourceFile(fileName)!)) {
    tsProject.removeSourceFile(sourceFile)
    sourceFile = tsProject.addSourceFileAtPath(fileName)
  } else {
    sourceFile = tsProject.addSourceFileAtPath(fileName)
  }

  sourceFile?.replaceWithText(code)

  patches.forEach((patch) => {
    const { action_type, source, value } = patch as any
    if (action_type === "updateAttribute") {
      let el = findElement(sourceFile, source)
      if (!el) {
        console.error(
          `Could not find element at ${source.fileName}:${source.lineNumber}:${source.columnNumber}`
        )
        return
      }
      Object.entries(value).forEach(([propPath, propValue]) => {
        setAttribute(el!, propPath, propValue)
      })
    } else if (action_type === "updateClassNamePart") {
      // Modify a specific string literal within a className expression
      const { partLine, partColumn, newValue } = value as {
        partLine: number
        partColumn: number
        newValue: string
      }
      if (
        !setClassNamePart(sourceFile, partLine, partColumn, newValue)
      ) {
        console.error(
          `Could not find className part at ${source.fileName}:${partLine}:${partColumn}`
        )
      }
    }
  })

  return sourceFile.getFullText()
}
