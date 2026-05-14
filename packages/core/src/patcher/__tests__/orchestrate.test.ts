import { describe, expect, test } from "bun:test"
import { applyPatches, groupPatchesByFile } from "../orchestrate.js"

interface TestPatch {
  file: string
  value: string
}

describe("groupPatchesByFile", () => {
  test("groups patches by file path", () => {
    const patches: TestPatch[] = [
      { file: "a.ts", value: "1" },
      { file: "b.ts", value: "2" },
      { file: "a.ts", value: "3" },
    ]

    const grouped = groupPatchesByFile(patches, (p) => p.file)
    expect(grouped["a.ts"]).toHaveLength(2)
    expect(grouped["b.ts"]).toHaveLength(1)
  })
})

describe("applyPatches", () => {
  test("applies patches to all files", async () => {
    const applied: string[] = []
    const patches: TestPatch[] = [
      { file: "a.ts", value: "1" },
      { file: "b.ts", value: "2" },
    ]

    await applyPatches(patches, (p) => p.file, async (file) => {
      applied.push(file)
    })

    expect(applied.sort()).toEqual(["a.ts", "b.ts"])
  })

  test("collects errors from individual files", async () => {
    const patches: TestPatch[] = [
      { file: "good.ts", value: "1" },
      { file: "bad.ts", value: "2" },
    ]

    await expect(
      applyPatches(patches, (p) => p.file, async (file) => {
        if (file === "bad.ts") throw new Error("write failed")
      }),
    ).rejects.toThrow("Patch failed for 1 file(s)")
  })

  test("serializes concurrent access to the same file", async () => {
    const log: string[] = []

    const patchesA: TestPatch[] = [{ file: "shared.ts", value: "A" }]
    const patchesB: TestPatch[] = [{ file: "shared.ts", value: "B" }]

    const applyFn = async (file: string, patches: TestPatch[]) => {
      const id = patches[0].value
      log.push(`start-${id}`)
      // Simulate async work
      await new Promise((r) => setTimeout(r, 30))
      log.push(`end-${id}`)
    }

    // Launch two concurrent applyPatches on the same file
    const p1 = applyPatches(patchesA, (p) => p.file, applyFn)
    const p2 = applyPatches(patchesB, (p) => p.file, applyFn)

    await Promise.all([p1, p2])

    // The mutex should serialize them: A completes before B starts
    // (or B before A, but they shouldn't interleave)
    const startA = log.indexOf("start-A")
    const endA = log.indexOf("end-A")
    const startB = log.indexOf("start-B")
    const endB = log.indexOf("end-B")

    // One must fully complete before the other starts
    const aBeforeB = endA < startB
    const bBeforeA = endB < startA
    expect(aBeforeB || bBeforeA).toBe(true)
  })

  test("allows concurrent access to different files", async () => {
    const log: string[] = []

    const patches: TestPatch[] = [
      { file: "file-x.ts", value: "X" },
      { file: "file-y.ts", value: "Y" },
    ]

    await applyPatches(patches, (p) => p.file, async (file, p) => {
      log.push(`start-${p[0].value}`)
      await new Promise((r) => setTimeout(r, 10))
      log.push(`end-${p[0].value}`)
    })

    // Both should have been processed
    expect(log).toContain("start-X")
    expect(log).toContain("start-Y")
    expect(log).toContain("end-X")
    expect(log).toContain("end-Y")
  })
})
