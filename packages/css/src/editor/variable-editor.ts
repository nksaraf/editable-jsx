import type { CSSVariable, CSSVariableManifest, CSSVariablePatch } from "../types.js"
import { createControl } from "./controls.js"

interface VariableState {
  original: string
  current: string
  variable: CSSVariable
}

/**
 * Variable editor panel — shows all CSS variables grouped by file/scope
 * with appropriate controls (color pickers, sliders, text inputs).
 */
export class VariableEditor {
  private container: HTMLElement
  private states: Map<string, VariableState> = new Map()
  private filter: string = ""
  private onSave: (patches: CSSVariablePatch[]) => void
  private lastManifest: CSSVariableManifest | null = null

  constructor(
    container: HTMLElement,
    onSave: (patches: CSSVariablePatch[]) => void,
  ) {
    this.container = container
    this.onSave = onSave
  }

  /**
   * Render the variable editor with the given manifest.
   */
  render(manifest: CSSVariableManifest): void {
    this.lastManifest = manifest
    this.container.textContent = ""
    this.states.clear()

    if (manifest.variables.length === 0) {
      const empty = document.createElement("div")
      empty.className = "empty-state"
      const p1 = document.createElement("p")
      p1.textContent = "No CSS variables found"
      const p2 = document.createElement("p")
      p2.textContent = "Add --custom-property declarations to your CSS"
      empty.appendChild(p1)
      empty.appendChild(p2)
      this.container.appendChild(empty)
      return
    }

    // Search input
    const search = document.createElement("input")
    search.className = "search-input"
    search.placeholder = "Filter variables..."
    search.value = this.filter
    search.addEventListener("input", () => {
      this.filter = search.value
      this.renderGroups(grouped, groupsContainer)
    })
    this.container.appendChild(search)

    // Group variables by file, then scope
    const grouped = this.groupVariables(manifest.variables)

    const groupsContainer = document.createElement("div")
    this.container.appendChild(groupsContainer)
    this.renderGroups(grouped, groupsContainer)

    // Footer
    const footer = document.createElement("div")
    footer.className = "panel-footer"

    const info = document.createElement("span")
    info.className = "footer-info"
    info.textContent = `${manifest.variables.length} variables`
    footer.appendChild(info)

    const actions = document.createElement("div")
    actions.className = "footer-actions"

    const resetBtn = document.createElement("button")
    resetBtn.className = "btn btn-secondary"
    resetBtn.textContent = "Reset"
    resetBtn.addEventListener("click", () => this.reset())

    const saveBtn = document.createElement("button")
    saveBtn.className = "btn btn-primary"
    saveBtn.textContent = "Save"
    saveBtn.addEventListener("click", () => this.save())

    actions.appendChild(resetBtn)
    actions.appendChild(saveBtn)
    footer.appendChild(actions)

    this.container.appendChild(footer)
  }

  private groupVariables(
    variables: CSSVariable[],
  ): Map<string, Map<string, CSSVariable[]>> {
    const byFile = new Map<string, Map<string, CSSVariable[]>>()

    for (const v of variables) {
      // Use relative path for display
      const displayFile = v.file.replace(/^.*\/src\//, "src/")

      if (!byFile.has(displayFile)) {
        byFile.set(displayFile, new Map())
      }
      const scopes = byFile.get(displayFile)!
      if (!scopes.has(v.scope)) {
        scopes.set(v.scope, [])
      }
      scopes.get(v.scope)!.push(v)
    }

    return byFile
  }

  private renderGroups(
    grouped: Map<string, Map<string, CSSVariable[]>>,
    container: HTMLElement,
  ): void {
    container.textContent = ""

    for (const [file, scopes] of grouped) {
      for (const [scope, variables] of scopes) {
        const filtered = this.filter
          ? variables.filter(
              (v) =>
                v.name.toLowerCase().includes(this.filter.toLowerCase()) ||
                v.value.toLowerCase().includes(this.filter.toLowerCase()),
            )
          : variables

        if (filtered.length === 0) continue

        const group = document.createElement("div")
        group.className = "var-group"

        // Group header
        const header = document.createElement("div")
        header.className = "var-group-header"

        const toggle = document.createElement("span")
        toggle.className = "var-group-toggle open"
        toggle.textContent = "\u25B6"

        const fileLabel = document.createElement("span")
        fileLabel.className = "var-group-file"
        fileLabel.textContent = file

        const scopeLabel = document.createElement("span")
        scopeLabel.className = "var-group-scope"
        scopeLabel.textContent = scope

        header.appendChild(toggle)
        header.appendChild(fileLabel)
        header.appendChild(scopeLabel)

        const items = document.createElement("div")
        items.className = "var-group-items"

        header.addEventListener("click", () => {
          const isOpen = toggle.classList.toggle("open")
          items.style.display = isOpen ? "" : "none"
        })

        // Variable rows
        for (const v of filtered) {
          const key = `${v.file}::${v.scope}::${v.name}`
          this.states.set(key, {
            original: v.value,
            current: v.value,
            variable: v,
          })

          const row = document.createElement("div")
          row.className = "var-row"

          const name = document.createElement("span")
          name.className = "var-name"
          name.textContent = v.name
          name.title = v.name

          const control = createControl(v.name, v.value, (newValue) => {
            const state = this.states.get(key)!
            state.current = newValue

            // Live preview: set the property on the document
            if (v.isGlobal || v.scope === ":root") {
              document.documentElement.style.setProperty(v.name, newValue)
            }

            // Show modified indicator
            const indicator = row.querySelector(".var-modified") as HTMLElement
            if (indicator) {
              indicator.style.display =
                state.current !== state.original ? "" : "none"
            }
          })

          const indicator = document.createElement("div")
          indicator.className = "var-modified"
          indicator.style.display = "none"

          row.appendChild(indicator)
          row.appendChild(name)
          row.appendChild(control)
          items.appendChild(row)
        }

        group.appendChild(header)
        group.appendChild(items)
        container.appendChild(group)
      }
    }
  }

  /**
   * Get all modified variables as patches.
   */
  getPatches(): CSSVariablePatch[] {
    const patches: CSSVariablePatch[] = []

    for (const [, state] of this.states) {
      if (state.current !== state.original) {
        patches.push({
          action_type: "updateCSSVariable",
          file: state.variable.file,
          variable: {
            name: state.variable.name,
            value: state.current,
            scope: state.variable.scope,
          },
          styleBlockOffset: state.variable.styleBlockOffset,
        })
      }
    }

    return patches
  }

  /**
   * Save all modified variables to source files.
   */
  save(): void {
    const patches = this.getPatches()
    if (patches.length === 0) return
    this.onSave(patches)
  }

  /**
   * Reset all variables to their original values.
   */
  reset(): void {
    for (const [, state] of this.states) {
      if (state.current !== state.original) {
        state.current = state.original
        // Remove live preview override
        if (state.variable.isGlobal || state.variable.scope === ":root") {
          document.documentElement.style.removeProperty(state.variable.name)
        }
      }
    }
    // Re-render controls to reflect the reset values
    if (this.lastManifest) {
      this.render(this.lastManifest)
    }
  }

  /**
   * Check if there are any unsaved changes.
   */
  hasChanges(): boolean {
    for (const [, state] of this.states) {
      if (state.current !== state.original) return true
    }
    return false
  }
}
