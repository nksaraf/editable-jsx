/**
 * Class Editor — renders a tag-style editor for space-separated
 * CSS class strings. Each class is shown as a removable tag,
 * and new classes can be added.
 *
 * Given "rounded-lg border ring-2 ring-blue-500":
 *
 *   ┌─────────────────────────────────────────────────┐
 *   │ [rounded-lg ×] [border ×] [ring-2 ×]           │
 *   │ [ring-blue-500 ×]                               │
 *   │ [+ add class________________________]           │
 *   └─────────────────────────────────────────────────┘
 *
 * Each tag can be removed (×) or edited (click to select + type).
 * The "add class" input lets you type new classes.
 * onChange fires with the full updated class string.
 */

/**
 * Create a class tag editor for a space-separated class string.
 *
 * @param classes — the current class string (e.g., "rounded-lg border")
 * @param onChange — called with the updated class string
 * @returns the DOM element for the editor
 */
export function createClassEditor(
  classes: string,
  onChange: (newClasses: string) => void,
): HTMLElement {
  const container = document.createElement("div")
  container.className = "class-editor"

  let currentClasses = classes.split(/\s+/).filter(Boolean)

  function render() {
    container.textContent = ""

    const tagRow = document.createElement("div")
    tagRow.className = "class-tags"

    for (let i = 0; i < currentClasses.length; i++) {
      const cls = currentClasses[i]
      const tag = createClassTag(cls, {
        onRemove: () => {
          currentClasses.splice(i, 1)
          onChange(currentClasses.join(" "))
          render()
        },
        onEdit: (newValue) => {
          if (newValue.trim()) {
            // Handle pasting multiple classes
            const parts = newValue.trim().split(/\s+/)
            currentClasses.splice(i, 1, ...parts)
          } else {
            currentClasses.splice(i, 1)
          }
          onChange(currentClasses.join(" "))
          render()
        },
      })
      tagRow.appendChild(tag)
    }

    container.appendChild(tagRow)

    // Add class input
    const addInput = document.createElement("input")
    addInput.className = "var-input class-add-input"
    addInput.placeholder = "+ add class"
    addInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && addInput.value.trim()) {
        const newClasses = addInput.value.trim().split(/\s+/)
        currentClasses.push(...newClasses)
        onChange(currentClasses.join(" "))
        addInput.value = ""
        render()
      }
    })

    container.appendChild(addInput)
  }

  render()
  return container
}

/**
 * Create a single class tag element.
 */
function createClassTag(
  className: string,
  handlers: {
    onRemove: () => void
    onEdit: (newValue: string) => void
  },
): HTMLElement {
  const tag = document.createElement("span")
  tag.className = "class-tag"

  const label = document.createElement("span")
  label.className = "class-tag-label"
  label.textContent = className
  label.title = className

  // Click to edit
  label.addEventListener("dblclick", () => {
    const input = document.createElement("input")
    input.className = "class-tag-edit"
    input.value = className
    input.style.width = `${Math.max(className.length, 3) + 2}ch`

    input.addEventListener("blur", () => {
      handlers.onEdit(input.value)
    })
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handlers.onEdit(input.value)
      }
      if (e.key === "Escape") {
        handlers.onEdit(className) // revert
      }
    })

    tag.replaceChild(input, label)
    input.focus()
    input.select()
  })

  const removeBtn = document.createElement("button")
  removeBtn.className = "class-tag-remove"
  removeBtn.textContent = "\u00d7"
  removeBtn.title = `Remove ${className}`
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation()
    handlers.onRemove()
  })

  tag.appendChild(label)
  tag.appendChild(removeBtn)

  return tag
}
