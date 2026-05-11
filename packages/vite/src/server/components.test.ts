/**
 * Tests for the AST-based React component detector.
 * Covers every export pattern that should be recognized as a React component.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { listComponents } from "./components"

const TMP = join(import.meta.dir, "__test_fixtures__")

beforeEach(() => {
  mkdirSync(TMP, { recursive: true })
})

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true })
})

function writeFixture(name: string, content: string) {
  writeFileSync(join(TMP, name), content, "utf-8")
}

async function detect(fileName: string, content: string): Promise<string[]> {
  writeFixture(fileName, content)
  const results = await listComponents(join(TMP, fileName))
  return results.flatMap((r) => r.components)
}

// ─── Function declarations ──────────────────────────────────────────

describe("export function declarations", () => {
  test("export default function", async () => {
    const comps = await detect(
      "a.tsx",
      `export default function Hero() { return <div>Hello</div> }`
    )
    expect(comps).toContain("Hero")
  })

  test("named export function", async () => {
    const comps = await detect(
      "b.tsx",
      `export function Card() { return <div className="card">X</div> }`
    )
    expect(comps).toContain("Card")
  })

  test("skips lowercase function (not a component)", async () => {
    const comps = await detect(
      "c.tsx",
      `export function helper() { return <div>X</div> }`
    )
    expect(comps).not.toContain("helper")
  })
})

// ─── Arrow functions ────────────────────────────────────────────────

describe("export const arrow functions", () => {
  test("arrow with block body returning JSX", async () => {
    const comps = await detect(
      "d.tsx",
      `export const Button = () => { return <button>Click</button> }`
    )
    expect(comps).toContain("Button")
  })

  test("arrow with expression body (implicit return JSX)", async () => {
    const comps = await detect(
      "e.tsx",
      `export const Badge = () => <span className="badge">New</span>`
    )
    expect(comps).toContain("Badge")
  })

  test("arrow with parenthesized JSX return", async () => {
    const comps = await detect(
      "f.tsx",
      `export const Layout = () => {
  return (
    <div className="layout">
      <main />
    </div>
  )
}`
    )
    expect(comps).toContain("Layout")
  })
})

// ─── forwardRef / memo / lazy ───────────────────────────────────────

describe("wrapper HOCs", () => {
  test("forwardRef", async () => {
    const comps = await detect(
      "g.tsx",
      `export const Input = forwardRef((props, ref) => <input ref={ref} {...props} />)`
    )
    expect(comps).toContain("Input")
  })

  test("React.forwardRef", async () => {
    const comps = await detect(
      "h.tsx",
      `export const TextArea = React.forwardRef((props, ref) => <textarea ref={ref} />)`
    )
    expect(comps).toContain("TextArea")
  })

  test("memo", async () => {
    const comps = await detect(
      "i.tsx",
      `export const ExpensiveList = memo(({ items }) => <ul>{items.map(i => <li key={i}>{i}</li>)}</ul>)`
    )
    expect(comps).toContain("ExpensiveList")
  })

  test("React.memo", async () => {
    const comps = await detect(
      "j.tsx",
      `export const Row = React.memo(function Row({ data }) { return <tr><td>{data}</td></tr> })`
    )
    expect(comps).toContain("Row")
  })
})

// ─── Hook usage detection ───────────────────────────────────────────

describe("hook-based component detection", () => {
  test("component using useState", async () => {
    const comps = await detect(
      "k.tsx",
      `export function Counter() {
  const [count, setCount] = useState(0)
  return <div>{count}</div>
}`
    )
    expect(comps).toContain("Counter")
  })

  test("component with only hooks, no direct JSX return", async () => {
    const comps = await detect(
      "l.tsx",
      `export function DataProvider({ children }) {
  useEffect(() => { fetch('/api') }, [])
  return <div>{children}</div>
}`
    )
    expect(comps).toContain("DataProvider")
  })
})

// ─── Re-exports ─────────────────────────────────────────────────────

describe("re-exports", () => {
  test("export { Foo } — named re-export", async () => {
    const comps = await detect(
      "m.tsx",
      `function Sidebar() { return <nav>...</nav> }
export { Sidebar }`
    )
    expect(comps).toContain("Sidebar")
  })

  test("skips lowercase re-exports", async () => {
    const comps = await detect(
      "n.tsx",
      `const config = {}
export { config }`
    )
    expect(comps).not.toContain("config")
  })

  test("export { X as Y }", async () => {
    const comps = await detect(
      "o.tsx",
      `function _Internal() { return <div/> }
export { _Internal as PublicCard }`
    )
    expect(comps).toContain("PublicCard")
  })

  test("export { A, B, C } — all PascalCase names returned", async () => {
    const comps = await detect(
      "multi-reexport.tsx",
      `function Header() { return <header/> }
function Footer() { return <footer/> }
function Sidebar() { return <nav/> }
export { Header, Footer, Sidebar }`
    )
    expect(comps).toContain("Header")
    expect(comps).toContain("Footer")
    expect(comps).toContain("Sidebar")
  })
})

// ─── Class components ───────────────────────────────────────────────

describe("class components", () => {
  test("export default class extends Component", async () => {
    const comps = await detect(
      "p.tsx",
      `export default class ErrorBoundary extends Component {
  render() { return <div>{this.props.children}</div> }
}`
    )
    expect(comps).toContain("ErrorBoundary")
  })
})

// ─── TypeScript-specific ────────────────────────────────────────────

describe("TypeScript patterns", () => {
  test("component with type annotation", async () => {
    const comps = await detect(
      "q.tsx",
      `export const Avatar: React.FC<{ src: string }> = ({ src }) => {
  return <img src={src} className="avatar" />
}`
    )
    // Arrow with expression body returning JSX
    expect(comps).toContain("Avatar")
  })

  test("component with interface", async () => {
    const comps = await detect(
      "r.tsx",
      `interface CardProps { title: string; description: string }
export function FeatureCard({ title, description }: CardProps) {
  return (
    <div className="rounded-xl p-6">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}`
    )
    expect(comps).toContain("FeatureCard")
  })
})

// ─── Multiple exports in one file ───────────────────────────────────

describe("multiple components per file", () => {
  test("detects all exported components", async () => {
    const comps = await detect(
      "s.tsx",
      `export function Header() { return <header>H</header> }
export function Footer() { return <footer>F</footer> }
export const Sidebar = () => <nav>S</nav>
function Internal() { return <div>I</div> } // not exported`
    )
    expect(comps).toContain("Header")
    expect(comps).toContain("Footer")
    expect(comps).toContain("Sidebar")
    expect(comps).not.toContain("Internal")
  })
})

// ─── JSX Fragment ───────────────────────────────────────────────────

describe("JSX fragments", () => {
  test("component returning fragment", async () => {
    const comps = await detect(
      "t.tsx",
      `export function List() { return <><li>A</li><li>B</li></> }`
    )
    expect(comps).toContain("List")
  })
})

// ─── Conditional returns (JSX inside if/switch) ────────────────────

describe("conditional returns", () => {
  test("JSX return inside if block", async () => {
    const comps = await detect(
      "cond1.tsx",
      `export function ConditionalInBlock({ show }) {
  if (show) {
    return <div className="tooltip">Visible</div>
  }
  return null
}`
    )
    expect(comps).toContain("ConditionalInBlock")
  })

  test("JSX return inside else block", async () => {
    const comps = await detect(
      "cond2.tsx",
      `export function ElseCase({ loading }) {
  if (loading) {
    return null
  } else {
    return <div>Loaded</div>
  }
}`
    )
    expect(comps).toContain("ElseCase")
  })

  test("JSX return inside switch case", async () => {
    const comps = await detect(
      "cond3.tsx",
      `export function SwitchComponent({ variant }) {
  switch (variant) {
    case "a": return <div>A</div>
    case "b": return <span>B</span>
    default: return null
  }
}`
    )
    expect(comps).toContain("SwitchComponent")
  })
})

// ─── Edge cases ─────────────────────────────────────────────────────

describe("edge cases", () => {
  test("empty file", async () => {
    const comps = await detect("empty.tsx", "")
    expect(comps).toHaveLength(0)
  })

  test("file with only types (no components)", async () => {
    const comps = await detect(
      "types.tsx",
      `export type Props = { x: number }
export interface Config { y: string }`
    )
    expect(comps).toHaveLength(0)
  })

  test("malformed file doesn't crash", async () => {
    const comps = await detect("bad.tsx", `export function { broken`)
    expect(comps).toHaveLength(0) // parse fails gracefully
  })
})
