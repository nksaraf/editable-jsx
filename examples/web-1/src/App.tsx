import { useEffect, useState, useSyncExternalStore } from "react"
import "./App.css"

import { EditableElement, Editor, EditorProvider } from "@editable-jsx/editable"
import { client } from "@editable-jsx/vite/src/client"
import { EditorPanel } from "./EditorPanel"

// ─── Devtools toggle ─────────────────────────────────────────────────
// Starts OFF. Press ⌘⇧E to activate. The app behaves 100% normally until then.

const devtoolsState = {
  active: false,
  listeners: new Set<() => void>(),
  toggle() {
    this.active = !this.active
    this.listeners.forEach((l) => l())
  },
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  },
  getSnapshot() {
    return this.active
  },
}

function useDevtoolsActive() {
  return useSyncExternalStore(
    (l) => devtoolsState.subscribe(l),
    () => devtoolsState.getSnapshot()
  )
}

// Register keyboard shortcut (once, at module level)
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "e") {
      e.preventDefault()
      devtoolsState.toggle()
    }
  })
}

// ─── Editor ──────────────────────────────────────────────────────────

class WebEditor extends Editor {
  constructor() {
    super([], client)
  }

  useElement(
    _Component: any,
    props: any,
    forwardRef?: any
  ): [EditableElement<any>, any] {
    const [el, p] = super.useElement(_Component, props, forwardRef)
    const active = useDevtoolsActive()

    // Only intercept clicks when devtools is active
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

globalThis.editor ??= new WebEditor()

// ─── Shared Components ──────────────────────────────────────────────

type Feature = {
  id: string
  icon: string
  title: string
  description: string
  tag: string
}

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

function FeatureCard({
  feature,
  variant = "default",
}: {
  feature: Feature
  variant?: "default" | "highlighted"
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{feature.icon}</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700">
          {feature.tag}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {feature.title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {feature.description}
      </p>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg px-4 py-3 text-center">
      <div className="font-bold text-red-900 dark:text-white underline text-2xl">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  )
}

// ─── Data ────────────────────────────────────────────────────────────

const features: Feature[] = [
  {
    id: "speed",
    icon: "\u26a1",
    title: "Lightning Fast",
    description: "Built on Vite for instant HMR and blazing fast builds.",
    tag: "Performance",
  },
  {
    id: "edit",
    icon: "\u270f\ufe0f",
    title: "Edit In Place",
    description: "Click any element to edit its Tailwind classes live.",
    tag: "Editor",
  },
  {
    id: "save",
    icon: "\ud83d\udcbe",
    title: "Save to Source",
    description: "Changes write back to your actual source files via AST patching.",
    tag: "DX",
  },
  {
    id: "ai",
    icon: "\ud83e\udd16",
    title: "AI-Ready",
    description: "Perfect for iterating on AI-generated UIs without round-trips.",
    tag: "AI",
  },
]

const stats = [
  { label: "Components", value: "12" },
  { label: "Lines Saved", value: "847" },
  { label: "Time Saved", value: "3.2h" },
]

// ─── App ─────────────────────────────────────────────────────────────

function DevtoolsBadge() {
  const active = useDevtoolsActive()
  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac")
  const shortcut = isMac ? "\u2318\u21e7E" : "Ctrl+Shift+E"

  if (active) return null

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        background: "#0f172a",
        color: "#64748b",
        fontSize: 11,
        fontFamily: "ui-monospace, monospace",
        padding: "4px 10px",
        borderRadius: 6,
        border: "1px solid #1e293b",
        zIndex: 100000,
        cursor: "pointer",
        opacity: 0.7,
        transition: "opacity 150ms",
      }}
      onClick={() => devtoolsState.toggle()}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1" }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7" }}
      title={`Toggle editor (${shortcut})`}
    >
      {shortcut} Editor
    </div>
  )
}

function App() {
  const [count, setCount] = useState(0)
  const devtoolsActive = useDevtoolsActive()

  return (
    <>
      {devtoolsActive ? <EditorPanel editor={editor} /> : <DevtoolsBadge />}
      <EditorProvider editor={editor}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
          {/* Header */}
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Editable JSX
            </h1>
            <p className="text-lg text-gray-500 dark:text-gray-400">
              Click any element below to edit its Tailwind classes in real-time
            </p>
          </div>

          {/* Stats row — shared component in a loop */}
          <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4 mb-8">
            {stats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>

          {/* Feature cards — shared component in a loop */}
          <div className="max-w-2xl mx-auto grid grid-cols-2 gap-4 mb-8">
            {features.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                variant="default"
              />
            ))}
          </div>

          {/* Simple counter */}
          <div className="max-w-2xl mx-auto text-center">
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
              onClick={() => setCount((c) => c + 1)}
            >
              Clicked {count} times
            </button>
          </div>
        </div>
      </EditorProvider>
    </>
  )
}

export default App
