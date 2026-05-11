/**
 * Drop-in visual editor for any React app using editable-jsx.
 *
 * Usage:
 *   import { DevEditor } from "@editable-jsx/vite/editor"
 *
 *   // Wrap your app (dev-only):
 *   <DevEditor>{children}</DevEditor>
 *
 * Toggle: ⌘⇧E (Cmd+Shift+E) or Ctrl+Shift+E
 * Select: Click any element when editor is active
 * Save: ⌘S to write className changes back to source
 * Escape: Clear selection
 */
import {
  type EditableElement,
  Editor,
  EditorProvider,
} from "@editable-jsx/editable"
import { type ReactNode, useEffect, useSyncExternalStore } from "react"
import { client } from "../client"
import { EditorPanel } from "./EditorPanel"

// ─── Devtools toggle ────────────────────────────────────────────────

const devtoolsState = {
  active: false,
  listeners: new Set<() => void>(),
  toggle() {
    this.active = !this.active
    this.listeners.forEach((l) => l())
  },
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  },
  getSnapshot() {
    return this.active
  },
}

export function useDevtoolsActive() {
  return useSyncExternalStore(
    (l) => devtoolsState.subscribe(l),
    () => devtoolsState.getSnapshot(),
  )
}

// Register keyboard shortcut
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "e") {
      e.preventDefault()
      devtoolsState.toggle()
    }
  })
}

// ─── Editor subclass with click-to-select ───────────────────────────

class WebEditor extends Editor {
  constructor() {
    super([], client as any)
  }

  useElement(
    _Component: any,
    props: any,
    forwardRef?: any,
  ): [EditableElement<any>, any] {
    const [el, p] = super.useElement(_Component, props, forwardRef)
    const active = useDevtoolsActive()

    useEffect(() => {
      if (!el.ref || !active) return
      function eventListener(e: Event) {
        e.stopPropagation()
        el.editor.select(el)
      }
      el.ref.addEventListener("click", eventListener)
      return () => {
        el.ref.removeEventListener("click", eventListener)
      }
    }, [el, forwardRef, active])

    return [el, p]
  }
}

// Singleton — survives HMR
;(globalThis as any).__editableJsxEditor ??= new WebEditor()
const editor: WebEditor = (globalThis as any).__editableJsxEditor

// ─── DevEditor component ────────────────────────────────────────────

/**
 * Drop-in wrapper that provides the full editable-jsx experience.
 * Wrap your app root with this in dev mode:
 *
 *   <DevEditor>{children}</DevEditor>
 *
 * Or conditionally:
 *
 *   import.meta.env.DEV
 *     ? <DevEditor><App /></DevEditor>
 *     : <App />
 */
export function DevEditor({ children }: { children: ReactNode }) {
  const active = useDevtoolsActive()

  return (
    <EditorProvider editor={editor}>
      {children}
      {active ? (
        <EditorPanel editor={editor} />
      ) : (
        <div
          style={{
            position: "fixed",
            bottom: 12,
            right: 12,
            background: "rgba(0,0,0,0.6)",
            color: "#666",
            padding: "4px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontFamily: "monospace",
            pointerEvents: "none",
            zIndex: 99999,
          }}
        >
          ⌘⇧E Editor
        </div>
      )}
    </EditorProvider>
  )
}
