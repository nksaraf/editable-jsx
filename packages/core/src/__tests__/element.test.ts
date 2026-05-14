import { describe, expect, test } from "bun:test"
import { ComponentTree } from "../element.js"
import type { ElementNode } from "../element.js"

function makeNode(id: string, overrides: Partial<ElementNode> = {}): ElementNode {
  return {
    id,
    displayName: id,
    elementName: id,
    source: { fileName: "test.tsx", lineNumber: 1, columnNumber: 1 },
    sourceFile: "test.tsx",
    componentName: null,
    framework: "react",
    properties: [],
    parentId: null,
    childIds: [],
    dirty: false,
    domNode: null,
    ...overrides,
  }
}

describe("ComponentTree", () => {
  test("walks all nodes in depth-first order", () => {
    const tree = new ComponentTree()
    const root = makeNode("root", { childIds: ["a", "b"] })
    const a = makeNode("a", { parentId: "root", childIds: ["c"] })
    const b = makeNode("b", { parentId: "root" })
    const c = makeNode("c", { parentId: "a" })

    tree.upsert(root)
    tree.upsert(a)
    tree.upsert(b)
    tree.upsert(c)

    const visited: string[] = []
    tree.walk((node) => visited.push(node.id))
    expect(visited).toEqual(["root", "a", "c", "b"])
  })

  test("walk does not infinite loop on cycles in childIds", () => {
    const tree = new ComponentTree()

    // Create a cycle: A -> B -> A
    const a = makeNode("a", { childIds: ["b"] })
    const b = makeNode("b", { parentId: "a", childIds: ["a"] })

    tree.nodes.set("a", a)
    tree.nodes.set("b", b)

    // Manually make 'a' a root by setting parentId to null
    a.parentId = null

    const visited: string[] = []
    // This should terminate thanks to cycle detection
    tree.walk((node) => visited.push(node.id))

    // Each node visited exactly once
    expect(visited).toEqual(["a", "b"])
  })

  test("walk handles self-referencing childIds", () => {
    const tree = new ComponentTree()

    const a = makeNode("a", { childIds: ["a"] })
    tree.nodes.set("a", a)

    const visited: string[] = []
    tree.walk((node) => visited.push(node.id))

    expect(visited).toEqual(["a"])
  })

  test("upsert updates parent childIds", () => {
    const tree = new ComponentTree()
    const parent = makeNode("parent")
    tree.upsert(parent)

    const child = makeNode("child", { parentId: "parent" })
    tree.upsert(child)

    expect(parent.childIds).toContain("child")
  })

  test("remove cleans up parent reference", () => {
    const tree = new ComponentTree()
    const parent = makeNode("parent", { childIds: ["child"] })
    const child = makeNode("child", { parentId: "parent" })
    tree.upsert(parent)
    tree.upsert(child)

    tree.remove("child")
    expect(parent.childIds).not.toContain("child")
    expect(tree.get("child")).toBeUndefined()
  })
})
