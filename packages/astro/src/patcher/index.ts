import { readFileSync, writeFileSync } from "node:fs"
import { applyPatches as coreApplyPatches } from "@editable-jsx/core"
import { suppressFile } from "@editable-jsx/core"
import type { AstroPatch } from "../types.js"
import { filesToSkipOnHmr } from "../server/hmr.js"
import { patchAttributes, patchText } from "./astro-template-patcher.js"

async function applyFilePatches(
  file: string,
  patches: AstroPatch[],
): Promise<void> {
  let code = readFileSync(file, "utf-8")

  const attrPatches = patches.filter(
    (p) => p.action_type === "updateAstroAttribute",
  )
  const textPatches = patches.filter(
    (p) => p.action_type === "updateAstroText",
  )

  if (attrPatches.length > 0) {
    code = await patchAttributes(code, attrPatches as any, file)
  }
  if (textPatches.length > 0) {
    code = await patchText(code, textPatches as any, file)
  }

  suppressFile(filesToSkipOnHmr, file)
  writeFileSync(file, code)
}

export async function applyPatches(patches: AstroPatch[]): Promise<void> {
  return coreApplyPatches(patches, (p) => p.file, applyFilePatches)
}
