import { describe, expect, test } from "bun:test"
import { readFileSync, existsSync } from "node:fs"
import { parseAstroVariables } from "../parse-astro.js"
import { buildManifest } from "../manifest.js"
import { applyAstroPatches } from "../../patcher/astro-patcher.js"

const LEPTON_WEB = "/Users/nikhilsaraf/garage/LeptonSoftware-web"
const HAS_LEPTON_WEB = existsSync(LEPTON_WEB)

const describeIfLepton = HAS_LEPTON_WEB ? describe : describe.skip

describeIfLepton("lepton-web integration", () => {
  test("parses BaseLayout.astro CSS variables", () => {
    const content = readFileSync(
      `${LEPTON_WEB}/src/layouts/BaseLayout.astro`,
      "utf-8",
    )
    const vars = parseAstroVariables(content, "BaseLayout.astro")

    // Should find all the :root variables
    const varNames = vars.map((v) => v.name)
    expect(varNames).toContain("--accent")
    expect(varNames).toContain("--bg")
    expect(varNames).toContain("--fg")
    expect(varNames).toContain("--font-display")
    expect(varNames).toContain("--container")
    expect(varNames).toContain("--gutter")
    expect(varNames).toContain("--footer-bg")

    // All should be global
    expect(vars.every((v) => v.isGlobal)).toBe(true)

    // Verify accent color exists with valid value
    const accent = vars.find((v) => v.name === "--accent")!
    expect(accent.value).toBeTruthy()
    expect(accent.scope).toBe(":root")
  })

  test("scans full project and finds all variables", async () => {
    const manifest = await buildManifest(LEPTON_WEB, {
      include: ["**/*.astro"],
      scanDirs: ["src"],
    })

    expect(manifest.variables.length).toBeGreaterThan(0)
    expect(manifest.files.length).toBeGreaterThan(0)

    // Should find variables from BaseLayout.astro
    const rootVars = manifest.variables.filter(
      (v) => v.scope === ":root" && v.isGlobal,
    )
    expect(rootVars.length).toBeGreaterThanOrEqual(12) // at least the :root vars

    console.log(
      `Found ${manifest.variables.length} variables in ${manifest.files.length} files`,
    )
  })

  test("patches accent color in BaseLayout.astro", () => {
    const content = readFileSync(
      `${LEPTON_WEB}/src/layouts/BaseLayout.astro`,
      "utf-8",
    )

    const styleOffset = content.indexOf("<style")
    const patched = applyAstroPatches(
      content,
      [
        {
          action_type: "updateCSSVariable",
          file: "BaseLayout.astro",
          variable: { name: "--accent", value: "#ff4444", scope: ":root" },
          styleBlockOffset: styleOffset,
        },
      ],
      "BaseLayout.astro",
    )

    // Accent should be updated
    expect(patched).toContain("--accent: #ff4444")
    // Other variables should be preserved
    expect(patched).toContain("--bg: #ffffff")
    expect(patched).toContain("--fg: #212121")
    // Frontmatter should be preserved
    expect(patched).toContain("import Analytics from")
    // Template should be preserved
    expect(patched).toContain('<html lang="en-US">')
  })

  test("patches multiple variables at once", () => {
    const content = readFileSync(
      `${LEPTON_WEB}/src/layouts/BaseLayout.astro`,
      "utf-8",
    )

    const styleOffset = content.indexOf("<style")
    const patched = applyAstroPatches(
      content,
      [
        {
          action_type: "updateCSSVariable",
          file: "BaseLayout.astro",
          variable: { name: "--accent", value: "#ff0000", scope: ":root" },
          styleBlockOffset: styleOffset,
        },
        {
          action_type: "updateCSSVariable",
          file: "BaseLayout.astro",
          variable: { name: "--bg", value: "#1a1a2e", scope: ":root" },
          styleBlockOffset: styleOffset,
        },
        {
          action_type: "updateCSSVariable",
          file: "BaseLayout.astro",
          variable: { name: "--fg", value: "#e2e8f0", scope: ":root" },
          styleBlockOffset: styleOffset,
        },
      ],
      "BaseLayout.astro",
    )

    expect(patched).toContain("--accent: #ff0000")
    expect(patched).toContain("--bg: #1a1a2e")
    expect(patched).toContain("--fg: #e2e8f0")
    // Unchanged ones should remain
    expect(patched).toContain("--container: 1200px")
    expect(patched).toContain("--gutter: 1.5rem")
  })
})
