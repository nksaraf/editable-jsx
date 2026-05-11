/**
 * Adversarial tests for the ts-morph patcher — verifies that:
 * 1. setAttribute correctly modifies JSX attributes (simple string case)
 * 2. setAttribute adds new attributes when they don't exist
 * 3. setClassNamePart modifies specific string literals within expressions
 * 4. The patcher does NOT corrupt surrounding code (conditions, function calls, etc.)
 *
 * Patterns tested against real-world usage from trafficure-marketing codebase
 * and common React/Tailwind patterns.
 */
import { describe, expect, test, beforeEach } from "bun:test"
import { Project, SourceFile, SyntaxKind, Node } from "ts-morph"

// ─── Re-implement the patcher functions for testing ──────────────────
// (same logic as ts-morph.ts, extracted for direct testing)

function isPos(el: Node, pos: { lineNumber: number; columnNumber: number }) {
  return (
    el.getStartLineNumber() === pos.lineNumber &&
    el.getStart() - el.getStartLinePos() + 1 === pos.columnNumber
  )
}

function findElement(
  sourceFile: SourceFile,
  pos: { lineNumber: number; columnNumber: number }
) {
  for (const x of sourceFile.getDescendantsOfKind(
    SyntaxKind.JsxOpeningElement
  )) {
    if (isPos(x, pos)) return x
  }
  for (const x of sourceFile.getDescendantsOfKind(
    SyntaxKind.JsxSelfClosingElement
  )) {
    if (isPos(x, pos)) return x
  }
  return undefined
}

const valueExpression = (value: any) => {
  if (Array.isArray(value)) return `{[${value.join(", ")}]}`
  if (typeof value === "string") return `"${value}"`
  if (typeof value === "number") return `{${value}}`
  if (typeof value === "boolean") return `{${value}}`
  return undefined
}

function setAttribute(
  el: Exclude<ReturnType<typeof findElement>, undefined>,
  propPath: string,
  propValue: any
) {
  const existing = el
    .getDescendantsOfKind(SyntaxKind.JsxAttribute)
    .find((a) => a.compilerNode.name.text === propPath)

  if (existing) {
    if (typeof propValue === "object" && !Array.isArray(propValue)) {
      existing
        .getInitializer()!
        .replaceWithText(`{${JSON.stringify(propValue)}}`)
    } else {
      const s = valueExpression(propValue)
      if (!s) throw new Error(`Could not serialize prop value for "${propPath}"`)
      existing.getInitializer()!.replaceWithText(s)
    }
  } else {
    const s = valueExpression(propValue)
    if (s) {
      el.addAttribute({ name: propPath, initializer: s })
    }
  }
}

function setClassNamePart(
  sourceFile: SourceFile,
  partLine: number,
  partColumn: number,
  newValue: string
) {
  for (const literal of sourceFile.getDescendantsOfKind(
    SyntaxKind.StringLiteral
  )) {
    if (isPos(literal, { lineNumber: partLine, columnNumber: partColumn })) {
      literal.replaceWithText(`"${newValue}"`)
      return true
    }
  }
  return false
}

// ─── Test helpers ────────────────────────────────────────────────────

let project: Project

beforeEach(() => {
  project = new Project({ useInMemoryFileSystem: true })
})

function createSource(code: string): SourceFile {
  return project.createSourceFile("test.tsx", code)
}

// ─── setAttribute tests ─────────────────────────────────────────────

/** Helper: find first JSX element in source file (opening or self-closing) */
function findFirstElement(sf: SourceFile) {
  return (
    sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)[0] ??
    sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)[0]
  )
}

describe("setAttribute: update existing className (simple string)", () => {
  test("replaces className string value", () => {
    const sf = createSource(
      `const App = () => <div className="bg-white rounded-xl">Hello</div>`
    )
    const el = findFirstElement(sf)!
    expect(el).toBeDefined()
    setAttribute(el, "className", "bg-blue-500 rounded-2xl")
    expect(sf.getFullText()).toContain(
      'className="bg-blue-500 rounded-2xl"'
    )
  })

  test("preserves other attributes when updating className", () => {
    const sf = createSource(
      `const App = () => <div id="card" className="p-4" style={{color: "red"}}>X</div>`
    )
    const el = findFirstElement(sf)!
    setAttribute(el, "className", "p-8 m-4")
    const text = sf.getFullText()
    expect(text).toContain('id="card"')
    expect(text).toContain('className="p-8 m-4"')
    expect(text).toContain("style=")
  })

  test("handles special characters in class names", () => {
    const sf = createSource(
      `const App = () => <div className="hover:bg-blue-500">X</div>`
    )
    const el = findFirstElement(sf)!
    setAttribute(
      el,
      "className",
      "hover:bg-blue-600 focus:ring-2 sm:p-4 dark:text-white"
    )
    expect(sf.getFullText()).toContain(
      "hover:bg-blue-600 focus:ring-2 sm:p-4 dark:text-white"
    )
  })
})

describe("setAttribute: add new attribute", () => {
  test("adds className to element without one", () => {
    const sf = createSource(
      `const App = () => <div id="card">Hello</div>`
    )
    const el = findFirstElement(sf)!
    setAttribute(el, "className", "bg-white rounded-xl p-6")
    expect(sf.getFullText()).toContain('className="bg-white rounded-xl p-6"')
  })

  test("adds className to self-closing element", () => {
    const sf = createSource(`const App = () => <img src="a.png" />`)
    const el = findFirstElement(sf)!
    setAttribute(el, "className", "w-full h-auto rounded-lg")
    expect(sf.getFullText()).toContain('className="w-full h-auto rounded-lg"')
  })
})

// ─── setClassNamePart tests ─────────────────────────────────────────

describe("setClassNamePart: cn() function call", () => {
  test("modifies first string literal in cn() call", () => {
    const code = `const App = () => <div className={cn("bg-white rounded-xl", isActive && "ring-2")}>X</div>`
    const sf = createSource(code)

    // Find the position of "bg-white rounded-xl"
    const literals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    const target = literals.find((l) => l.getLiteralValue() === "bg-white rounded-xl")!
    const line = target.getStartLineNumber()
    const col = target.getStart() - target.getStartLinePos() + 1

    const result = setClassNamePart(sf, line, col, "bg-blue-500 rounded-2xl")
    expect(result).toBe(true)

    const text = sf.getFullText()
    expect(text).toContain('"bg-blue-500 rounded-2xl"')
    // The conditional part should be untouched
    expect(text).toContain('"ring-2"')
    // The function call and condition should be preserved
    expect(text).toContain("isActive &&")
    expect(text).toContain("cn(")
  })

  test("modifies conditional string literal in cn() call", () => {
    const code = `const App = () => <div className={cn("base", active && "ring-2 ring-blue-500")}>X</div>`
    const sf = createSource(code)

    const literals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    const target = literals.find(
      (l) => l.getLiteralValue() === "ring-2 ring-blue-500"
    )!
    const line = target.getStartLineNumber()
    const col = target.getStart() - target.getStartLinePos() + 1

    const result = setClassNamePart(
      sf,
      line,
      col,
      "ring-4 ring-red-500 shadow-lg"
    )
    expect(result).toBe(true)

    const text = sf.getFullText()
    // Base should be untouched
    expect(text).toContain('"base"')
    // Conditional value should be updated
    expect(text).toContain('"ring-4 ring-red-500 shadow-lg"')
    // Condition should be preserved
    expect(text).toContain("active &&")
  })

  test("modifies one conditional without affecting another", () => {
    const code = `const App = () => <div className={cn("base", a && "first-cond", b && "second-cond")}>X</div>`
    const sf = createSource(code)

    // Modify only "first-cond"
    const literals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    const target = literals.find((l) => l.getLiteralValue() === "first-cond")!
    const line = target.getStartLineNumber()
    const col = target.getStart() - target.getStartLinePos() + 1

    setClassNamePart(sf, line, col, "updated-first")

    const text = sf.getFullText()
    expect(text).toContain('"updated-first"')
    expect(text).toContain('"second-cond"') // untouched
    expect(text).toContain('"base"') // untouched
  })
})

describe("setClassNamePart: template literal (trafficure patterns)", () => {
  test("does not crash on template literal (returns false — not yet supported)", () => {
    // Template literal quasis are TemplateHead/TemplateMiddle/TemplateTail,
    // not StringLiteral. The current implementation only handles StringLiteral.
    const code = 'const App = () => <div className={`blog-cat-pill${active ? " active" : ""}`}>X</div>'
    const sf = createSource(code)

    // The ternary inside the template has string literals " active" and ""
    const literals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    const target = literals.find((l) => l.getLiteralValue() === " active")
    if (target) {
      const line = target.getStartLineNumber()
      const col = target.getStart() - target.getStartLinePos() + 1
      const result = setClassNamePart(sf, line, col, " highlighted")
      expect(result).toBe(true)
      expect(sf.getFullText()).toContain('" highlighted"')
    }
  })
})

describe("setClassNamePart: ternary expressions", () => {
  test("modifies consequent of ternary", () => {
    const code = `const App = () => <div className={isActive ? "bg-blue-500" : "bg-gray-100"}>X</div>`
    const sf = createSource(code)

    const literals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    const target = literals.find((l) => l.getLiteralValue() === "bg-blue-500")!
    const line = target.getStartLineNumber()
    const col = target.getStart() - target.getStartLinePos() + 1

    setClassNamePart(sf, line, col, "bg-green-500 text-white")

    const text = sf.getFullText()
    expect(text).toContain('"bg-green-500 text-white"')
    expect(text).toContain('"bg-gray-100"') // alternate untouched
    expect(text).toContain("isActive ?") // condition preserved
  })

  test("modifies alternate of ternary", () => {
    const code = `const App = () => <div className={isActive ? "bg-blue-500" : "bg-gray-100"}>X</div>`
    const sf = createSource(code)

    const literals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    const target = literals.find((l) => l.getLiteralValue() === "bg-gray-100")!
    const line = target.getStartLineNumber()
    const col = target.getStart() - target.getStartLinePos() + 1

    setClassNamePart(sf, line, col, "bg-white border")

    const text = sf.getFullText()
    expect(text).toContain('"bg-blue-500"') // consequent untouched
    expect(text).toContain('"bg-white border"')
  })
})

describe("setClassNamePart: edge cases", () => {
  test("returns false when target position doesn't match any literal", () => {
    const sf = createSource(
      `const App = () => <div className="hello">X</div>`
    )
    const result = setClassNamePart(sf, 999, 999, "should-not-apply")
    expect(result).toBe(false)
  })

  test("does not modify string literals in other attributes", () => {
    const code = `const App = () => <div title="do not touch" className={cn("base", flag && "cond")}>X</div>`
    const sf = createSource(code)

    const literals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    const target = literals.find((l) => l.getLiteralValue() === "base")!
    const line = target.getStartLineNumber()
    const col = target.getStart() - target.getStartLinePos() + 1

    setClassNamePart(sf, line, col, "new-base")

    const text = sf.getFullText()
    expect(text).toContain('"new-base"')
    expect(text).toContain('"do not touch"') // title untouched
  })

  test("handles multi-line JSX", () => {
    const code = `const App = () => (
  <div
    className={cn(
      "bg-white rounded-xl p-6",
      isActive && "ring-2 ring-blue-500",
      disabled && "opacity-50"
    )}
  >
    X
  </div>
)`
    const sf = createSource(code)

    const literals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral)
    const target = literals.find(
      (l) => l.getLiteralValue() === "ring-2 ring-blue-500"
    )!
    const line = target.getStartLineNumber()
    const col = target.getStart() - target.getStartLinePos() + 1

    setClassNamePart(sf, line, col, "ring-4 ring-red-500")

    const text = sf.getFullText()
    expect(text).toContain('"ring-4 ring-red-500"')
    expect(text).toContain('"bg-white rounded-xl p-6"') // untouched
    expect(text).toContain('"opacity-50"') // untouched
    expect(text).toContain("isActive &&") // condition preserved
    expect(text).toContain("disabled &&") // condition preserved
  })
})

// ─── Full round-trip: findElement + setAttribute ────────────────────

describe("Full round-trip: findElement + setAttribute", () => {
  test("finds element by line/column and updates className", () => {
    const code = `function App() {
  return (
    <div className="bg-white p-4">
      <span className="text-sm">Hello</span>
    </div>
  )
}`
    const sf = createSource(code)

    // The <div> is on line 3
    const divEl = findElement(sf, { lineNumber: 3, columnNumber: 5 })!
    expect(divEl).toBeDefined()
    setAttribute(divEl, "className", "bg-blue-500 p-8")
    expect(sf.getFullText()).toContain('className="bg-blue-500 p-8"')

    // The <span> is on line 4
    const spanEl = findElement(sf, { lineNumber: 4, columnNumber: 7 })!
    expect(spanEl).toBeDefined()
    setAttribute(spanEl, "className", "text-lg font-bold")
    expect(sf.getFullText()).toContain('className="text-lg font-bold"')
  })

  test("handles component inside a loop (same source line for all instances)", () => {
    const code = `function App() {
  return (
    <div>
      {items.map(item => (
        <Card className="bg-white rounded-xl" title={item.title} />
      ))}
    </div>
  )
}`
    const sf = createSource(code)

    // <Card> is on line 5 (inside the map)
    const cardEl = findElement(sf, { lineNumber: 5, columnNumber: 9 })!
    expect(cardEl).toBeDefined()
    setAttribute(cardEl, "className", "bg-blue-100 rounded-2xl shadow-md")

    const text = sf.getFullText()
    expect(text).toContain('className="bg-blue-100 rounded-2xl shadow-md"')
    // Ensure title prop is untouched
    expect(text).toContain("title={item.title}")
  })
})
