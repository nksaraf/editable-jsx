import { describe, expect, test } from "bun:test"
import { patchFramework, createPatchDispatcher, type Patch } from "../patch-types.js"

describe("patchFramework", () => {
  test("extracts css from css.variable", () => {
    expect(patchFramework({ action_type: "css.variable", file: "f" } as Patch)).toBe("css")
  })

  test("extracts astro from astro.attribute", () => {
    expect(patchFramework({ action_type: "astro.attribute", file: "f" } as Patch)).toBe("astro")
  })

  test("extracts jsx from jsx.attribute", () => {
    expect(patchFramework({ action_type: "jsx.attribute", file: "f" } as Patch)).toBe("jsx")
  })

  test("extracts text from text.replace", () => {
    expect(patchFramework({ action_type: "text.replace", file: "f" } as Patch)).toBe("text")
  })
})

describe("createPatchDispatcher", () => {
  test("routes patches to the right handler by framework", async () => {
    const called: string[] = []

    const dispatcher = createPatchDispatcher({
      css: async (_file, patches) => { called.push(`css:${patches.length}`) },
      text: async (_file, patches) => { called.push(`text:${patches.length}`) },
    })

    const patches: Patch[] = [
      { action_type: "css.variable", file: "a.css", variable: { name: "--x", value: "1", scope: ":root" }, styleBlockOffset: 0 },
      { action_type: "css.property", file: "a.css", property: { selector: ".x", name: "color", value: "red" } },
      { action_type: "text.replace", file: "a.css", oldText: "old", newText: "new", line: 0, col: 0 },
    ]

    await dispatcher("a.css", patches)

    expect(called).toContain("css:2")
    expect(called).toContain("text:1")
  })

  test("warns on unknown framework", async () => {
    const dispatcher = createPatchDispatcher({})
    const patches: Patch[] = [
      { action_type: "unknown.thing" as any, file: "f" } as any,
    ]

    // Should not throw, just warn
    await dispatcher("f", patches)
  })
})
