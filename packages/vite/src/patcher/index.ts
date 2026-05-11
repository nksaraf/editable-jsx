import { EditPatch } from "@editable-jsx/state"
import { readFileSync, writeFileSync } from "node:fs"
import { filesToSkipOnHmr } from "../server/hmr"
import { tsMorphPatcher } from "./ts-morph"

const groupPatchesByFileName = (patches: EditPatch[]) => {
  return patches.reduce((accum, x) => {
    ;(accum[x.source.fileName] = accum[x.source.fileName] || []).push(x)
    return accum
  }, {} as Record<string, EditPatch[]>)
}

async function applyFilePatches(fileName: string, patches: EditPatch[]) {
  let code = readFileSync(fileName, "utf-8")

  code = await tsMorphPatcher(
    fileName,
    code,
    patches.filter(
      (p) =>
        p.action_type === "updateAttribute" ||
        p.action_type === "updateClassNamePart"
    )
  )

  // Tell HMR to skip this file — we already applied the changes in the browser
  filesToSkipOnHmr.set(fileName, { skip: true, timeout: null })
  writeFileSync(fileName, code)
}

export async function applyPatches(data: EditPatch[]): Promise<void> {
  const grouped = groupPatchesByFileName(data)
  const errors: Array<{ fileName: string; error: Error }> = []

  await Promise.all(
    Object.entries(grouped).map(async ([fileName, patches]) => {
      try {
        await applyFilePatches(fileName, patches)
      } catch (err: any) {
        console.error(
          `[editable-jsx] Failed to apply patches to ${fileName}:`,
          err
        )
        errors.push({ fileName, error: err })
      }
    })
  )

  if (errors.length > 0) {
    const fileList = errors.map((e) => e.fileName).join(", ")
    throw new Error(
      `Patch failed for ${errors.length} file(s): ${fileList}. ${errors[0].error.message}`
    )
  }
}
