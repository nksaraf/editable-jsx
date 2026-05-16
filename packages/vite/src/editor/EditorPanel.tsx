import { useCallback, useEffect, useRef, useState } from "react"
import type { EditableElement, Editor } from "@editable-jsx/editable"

// ─── Selection Overlay ───────────────────────────────────────────────

function SelectionOverlay({ editor }: { editor: Editor }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [info, setInfo] = useState<{
    name: string
    source: string
    line: number
  } | null>(null)

  useEffect(() => {
    const update = () => {
      const sel = editor.selectedElement
      if (!sel || !sel.ref || !(sel.ref instanceof Element)) {
        setRect(null)
        setInfo(null)
        return
      }
      const r = sel.ref.getBoundingClientRect()
      setRect(r)
      setInfo({
        name: sel.displayName,
        source: sel.source?.fileName?.split("/").pop() || "",
        line: sel.source?.lineNumber || 0
      })
    }

    update()
    const id = setInterval(update, 100)
    const sub = editor.service.subscribe(update)

    return () => {
      clearInterval(id)
      sub.unsubscribe()
    }
  }, [editor])

  if (!rect || !info) return null

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: rect.left - 1,
          top: rect.top - 1,
          width: rect.width + 2,
          height: rect.height + 2,
          border: "2px solid #3b82f6",
          borderRadius: 2,
          pointerEvents: "none",
          zIndex: 99998,
          transition: "all 80ms ease-out"
        }}
      />
      <div
        style={{
          position: "fixed",
          left: rect.left - 1,
          top: Math.max(0, rect.top - 22),
          background: "#3b82f6",
          color: "#fff",
          fontSize: 10,
          fontFamily: "ui-monospace, monospace",
          padding: "2px 6px",
          borderRadius: "3px 3px 0 0",
          pointerEvents: "none",
          zIndex: 99999,
          whiteSpace: "nowrap",
          transition: "all 80ms ease-out"
        }}
      >
        {"<"}
        {info.name.split(".").pop()}
        {">"}{" "}
        <span style={{ opacity: 0.6 }}>
          {info.source}:{info.line}
        </span>
      </div>
    </>
  )
}

// ─── Hover Overlay ───────────────────────────────────────────────────

function HoverOverlay({ editor }: { editor: Editor }) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    function onMouseOver(e: MouseEvent) {
      const target = e.target as Element
      if (!target || target.closest("[data-editor-panel]")) {
        setRect(null)
        return
      }
      const el = (target as any)._editableElement as EditableElement | undefined
      if (el) {
        setRect(target.getBoundingClientRect())
      }
    }

    function onMouseOut() {
      setRect(null)
    }

    document.addEventListener("mouseover", onMouseOver)
    document.addEventListener("mouseout", onMouseOut)
    return () => {
      document.removeEventListener("mouseover", onMouseOver)
      document.removeEventListener("mouseout", onMouseOut)
    }
  }, [editor])

  if (!rect) return null

  return (
    <div
      style={{
        position: "fixed",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        border: "1px dashed #94a3b8",
        background: "rgba(59, 130, 246, 0.04)",
        pointerEvents: "none",
        zIndex: 99997,
        transition: "all 60ms ease-out"
      }}
    />
  )
}

// ─── Element Tree ────────────────────────────────────────────────────

function TreeNode({
  element,
  editor,
  depth = 0
}: {
  element: EditableElement
  editor: Editor
  depth?: number
}) {
  const [collapsed, setCollapsed] = useState(depth > 2)
  const isSelected = editor.state.context.selectedId === element.treeId
  const children = element.childIds
    .map((id) => editor.getElementById(id))
    .filter(Boolean)
  const hasChildren = children.length > 0
  const isPrimitive =
    element.elementName.charAt(0) ===
    element.elementName.charAt(0).toLowerCase()

  // Show className preview in tree
  const cls = element.currentProps?.className
  const clsPreview = cls
    ? cls.length > 20
      ? cls.slice(0, 20) + "\u2026"
      : cls
    : ""

  return (
    <div>
      <div
        onClick={(e) => {
          e.stopPropagation()
          editor.select(element)
        }}
        style={{
          paddingLeft: depth * 14 + 6,
          paddingTop: 2,
          paddingBottom: 2,
          paddingRight: 6,
          cursor: "pointer",
          fontSize: 11,
          fontFamily: "ui-monospace, monospace",
          background: isSelected ? "#3b82f615" : "transparent",
          borderLeft: isSelected
            ? "2px solid #3b82f6"
            : "2px solid transparent",
          color: isPrimitive ? "#94a3b8" : "#e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: 3,
          lineHeight: "18px"
        }}
        onMouseEnter={(e) => {
          if (!isSelected)
            (e.currentTarget as HTMLElement).style.background = "#ffffff06"
        }}
        onMouseLeave={(e) => {
          if (!isSelected)
            (e.currentTarget as HTMLElement).style.background = "transparent"
        }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation()
              setCollapsed(!collapsed)
            }}
            style={{
              width: 12,
              display: "inline-block",
              textAlign: "center",
              opacity: 0.4,
              userSelect: "none",
              fontSize: 8
            }}
          >
            {collapsed ? "\u25b6" : "\u25bc"}
          </span>
        ) : (
          <span style={{ width: 12, display: "inline-block" }} />
        )}
        <span>
          <span style={{ color: isPrimitive ? "#64748b" : "#60a5fa" }}>
            {element.elementName}
          </span>
          {clsPreview && (
            <span style={{ color: "#475569", marginLeft: 4 }}>
              .{clsPreview.split(" ")[0]}
            </span>
          )}
        </span>
      </div>
      {!collapsed &&
        children.map((child) => (
          <TreeNode
            key={child.id}
            element={child}
            editor={editor}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}

// ─── className Parts Editor (for expression-based classNames) ────────

type ClassNamePart = {
  value: string
  line: number
  column: number
  type: "static" | "conditional" | "template" | "fallback"
}

function ClassNamePartsEditor({
  parts,
  selected,
  editor,
  debugLog
}: {
  parts: ClassNamePart[]
  selected: EditableElement
  editor: Editor
  debugLog: (action: string, data?: Record<string, any>) => void
}) {
  // Track each part's edited value separately
  const [partValues, setPartValues] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {}
    for (const part of parts) {
      vals[`${part.line}:${part.column}`] = part.value
    }
    return vals
  })
  const [isSaving, setIsSaving] = useState(false)

  // Check which parts have been modified
  const modifiedParts = parts.filter(
    (p) => partValues[`${p.line}:${p.column}`] !== p.value
  )
  const hasChanges = modifiedParts.length > 0

  // Find source siblings for live preview
  const findSourceSiblings = useCallback(() => {
    if (!selected.source?.lineNumber) return []
    const allEls = Object.values(
      editor.store.getState().elements
    ) as EditableElement[]
    return allEls.filter(
      (e) =>
        e.id !== selected.id &&
        e.source?.lineNumber === selected.source?.lineNumber &&
        e.source?.columnNumber === selected.source?.columnNumber &&
        e.source?.fileName === selected.source?.fileName
    )
  }, [editor, selected])

  // Apply a part change live
  const applyPartLive = useCallback(
    (partKey: string, newValue: string) => {
      setPartValues((prev) => ({ ...prev, [partKey]: newValue }))

      // Compute the full className by joining all parts
      const allValues = { ...partValues, [partKey]: newValue }
      const fullClassName = parts
        .map((p) => allValues[`${p.line}:${p.column}`])
        .filter(Boolean)
        .join(" ")

      // Apply to DOM — selected and all siblings (Element covers both HTML and SVG)
      if (selected.ref instanceof Element) {
        selected.ref.setAttribute("class", fullClassName)
      }
      for (const sib of findSourceSiblings()) {
        if (sib.ref instanceof Element) {
          sib.ref.setAttribute("class", fullClassName)
        }
      }
    },
    [parts, partValues, selected, findSourceSiblings]
  )

  // Save modified parts to source
  const saveParts = useCallback(async () => {
    setIsSaving(true)
    debugLog("SAVE_PARTS_START", {
      modifiedCount: modifiedParts.length,
      parts: modifiedParts.map((p) => ({
        type: p.type,
        original: p.value,
        new: partValues[`${p.line}:${p.column}`]
      }))
    })

    try {
      // Create one patch per modified part
      const patches = modifiedParts.map((part) => ({
        action_type: "updateClassNamePart" as const,
        source: selected.source,
        value: {
          partLine: part.line,
          partColumn: part.column,
          newValue: partValues[`${part.line}:${part.column}`]
        }
      }))

      await editor.save(patches as any)

      // Clear overrides
      delete selected.props.className
      debugLog("SAVE_PARTS_OK")
    } catch (e: any) {
      debugLog("SAVE_PARTS_ERROR", { error: e.message })
      console.error("Save failed:", e)
    }
    setIsSaving(false)
  }, [modifiedParts, partValues, selected, editor, debugLog])

  const partLabel = (type: string) => {
    switch (type) {
      case "static":
        return "base"
      case "conditional":
        return "when"
      case "template":
        return "template"
      case "fallback":
        return "fallback"
      default:
        return type
    }
  }

  const partColor = (type: string) => {
    switch (type) {
      case "static":
        return { label: "#86efac", border: "#86efac30" }
      case "conditional":
        return { label: "#a78bfa", border: "#a78bfa30" }
      case "template":
        return { label: "#fbbf24", border: "#fbbf2430" }
      case "fallback":
        return { label: "#94a3b8", border: "#94a3b840" }
      default:
        return { label: "#94a3b8", border: "#33415530" }
    }
  }

  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 4
        }}
      >
        className
        <span
          style={{
            color: "#a78bfa",
            textTransform: "none",
            fontWeight: 400,
            letterSpacing: 0
          }}
        >
          (expression — {parts.length} parts)
        </span>
      </div>

      {parts.map((part, i) => {
        const key = `${part.line}:${part.column}`
        const currentValue = partValues[key] ?? part.value
        const isModified = currentValue !== part.value
        const colors = partColor(part.type)

        return (
          <div key={key} style={{ marginBottom: 6 }}>
            <div
              style={{
                fontSize: 9,
                color: colors.label,
                marginBottom: 2,
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "ui-monospace, monospace"
              }}
            >
              <span
                style={{
                  padding: "0 4px",
                  background: colors.border,
                  borderRadius: 3,
                  fontWeight: 600,
                  textTransform: "uppercase"
                }}
              >
                {partLabel(part.type)}
              </span>
              <span style={{ color: "#475569" }}>
                L{part.line}:{part.column}
              </span>
            </div>
            <textarea
              value={currentValue}
              onChange={(e) => applyPartLive(key, e.target.value)}
              spellCheck={false}
              style={{
                width: "100%",
                background: "#0c1222",
                border: isModified
                  ? `1px solid ${colors.label}`
                  : `1px solid ${colors.border}`,
                color: "#e2e8f0",
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
                padding: "4px 6px",
                borderRadius: 4,
                outline: "none",
                resize: "none",
                minHeight: 28,
                lineHeight: "16px",
                boxSizing: "border-box"
              }}
            />
          </div>
        )
      })}

      {hasChanges && (
        <button
          onClick={saveParts}
          disabled={isSaving}
          style={{
            background: "#3b82f6",
            border: "none",
            color: "#fff",
            fontSize: 11,
            padding: "5px 10px",
            borderRadius: 5,
            cursor: "pointer",
            fontWeight: 600,
            opacity: isSaving ? 0.6 : 1,
            width: "100%",
            marginTop: 4
          }}
        >
          {isSaving
            ? "Saving\u2026"
            : `Save ${modifiedParts.length} part${modifiedParts.length > 1 ? "s" : ""} to source`}
        </button>
      )}
    </div>
  )
}

// ─── className Editor (the main editing experience) ──────────────────

function ClassNameEditor({
  editor,
  selected
}: {
  editor: Editor
  selected: EditableElement
}) {
  // IMPORTANT: Always initialize from currentProps (source-of-truth from the file).
  // Never read from selected.props — that's a mutable override bag that persists
  // across saves and can hold stale values (including "" from delete-all gestures).
  const [savedClassName, setSavedClassName] = useState(
    selected.currentProps?.className ?? ""
  )
  const [value, setValue] = useState(
    selected.currentProps?.className ?? ""
  )
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasChanges = value !== savedClassName

  // Debug logging — check browser console for [ClassNameEditor] messages
  const debugLog = useCallback(
    (action: string, data?: Record<string, any>) => {
      console.log(
        `%c[ClassNameEditor]%c ${action}`,
        "color: #3b82f6; font-weight: bold",
        "color: inherit",
        {
          elementId: selected.id,
          elementName: selected.displayName,
          "currentProps.className": selected.currentProps?.className,
          "props.className": selected.props?.className,
          "changes": Object.keys(selected.changes || {}),
          ...data
        }
      )
    },
    [selected]
  )

  // Log on mount/remount
  useEffect(() => {
    debugLog("MOUNT", { savedClassName, value })
  }, [])

  // Sync when selection changes (key={selected.id} causes remount, but this
  // handles edge cases where the same id re-selects with updated currentProps)
  useEffect(() => {
    const cls = selected.currentProps?.className ?? ""
    debugLog("SYNC (selected.id changed)", { newCls: cls, oldValue: value })
    setValue(cls)
    setSavedClassName(cls)
  }, [selected.id])

  // Find all elements sharing the same source position (loop siblings)
  const findSourceSiblings = useCallback(() => {
    if (!selected.source?.lineNumber) return []
    const allEls = Object.values(
      editor.store.getState().elements
    ) as EditableElement[]
    return allEls.filter(
      (e) =>
        e.id !== selected.id &&
        e.source?.lineNumber === selected.source?.lineNumber &&
        e.source?.columnNumber === selected.source?.columnNumber &&
        e.source?.fileName === selected.source?.fileName
    )
  }, [editor, selected])

  // Apply live as you type — updates ALL loop siblings in real-time
  const applyLive = useCallback(
    (newValue: string) => {
      debugLog("APPLY_LIVE", { newValue })
      setValue(newValue)

      // Apply directly to DOM for instant feedback — this element
      // Use setAttribute("class") so it works for both HTML and SVG elements
      if (selected.ref instanceof Element) {
        selected.ref.setAttribute("class", newValue)
      }

      // Apply to ALL loop siblings too (same source line = same component template)
      const siblings = findSourceSiblings()
      for (const sib of siblings) {
        if (sib.ref instanceof Element) {
          sib.ref.setAttribute("class", newValue)
        }
      }

      // Track as a change for save
      selected.props.className = newValue
      selected.addChange(selected, ["className"], newValue)
      selected.changed = true
    },
    [selected, debugLog, findSourceSiblings]
  )

  // Save to source
  const save = useCallback(async () => {
    debugLog("SAVE_START", { valueToSave: value })
    setIsSaving(true)
    try {
      await selected.save()
      // Update baseline so hasChanges becomes false and Save button disappears
      setSavedClassName(value)
      // Clear the mutable props override — the source file now has the value,
      // so on next render update() will read it from the JSX source props.
      delete selected.props.className
      debugLog("SAVE_OK", { savedClassName: value, propsCleared: true })
    } catch (e: any) {
      debugLog("SAVE_ERROR", { error: e.message })
      console.error("Save failed:", e)
    }
    setIsSaving(false)
  }, [selected, value, debugLog])

  // Find all elements that share the same original className
  const findMatchingElements = useCallback(() => {
    if (!savedClassName) return []
    const allEls = Object.values(
      editor.store.getState().elements
    ) as EditableElement[]
    return allEls.filter(
      (el) =>
        el.id !== selected.id &&
        el.currentProps?.className === savedClassName
    )
  }, [editor, selected, savedClassName])

  const matchingElements = savedClassName ? findMatchingElements() : []

  // Apply to all matching elements
  const applyToAll = useCallback(async () => {
    setIsSaving(true)
    try {
      // Apply change to all matching elements
      for (const el of matchingElements) {
        el.props.className = value
        el.addChange(el, ["className"], value)
        el.changed = true
        if (el.ref instanceof Element) {
          el.ref.setAttribute("class", value)
        }
        el.render()
      }

      // Save all (including current)
      const allToSave = [selected, ...matchingElements]
      for (const el of allToSave) {
        await el.save()
        delete el.props.className  // Clear override so source-of-truth takes over
      }
      setSavedClassName(value)
    } catch (e: any) {
      console.error("Save all failed:", e)
    }
    setIsSaving(false)
  }, [selected, matchingElements, value])

  // Keyboard shortcuts
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        save()
      }
      if (e.key === "Escape") {
        // Revert
        applyLive(savedClassName)
      }
    },
    [save, applyLive, savedClassName]
  )

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = "auto"
      ta.style.height = ta.scrollHeight + "px"
    }
  }, [value])

  // Split classes for tag display
  const classes = value
    .split(/\s+/)
    .filter(Boolean)

  return (
    <div style={{ padding: "8px 10px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#e2e8f0",
              fontFamily: "ui-monospace, monospace"
            }}
          >
            {"<"}
            <span style={{ color: "#60a5fa" }}>{selected.elementName}</span>
            {">"}
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>
            {selected.source?.fileName?.split("/").pop()}:
            {selected.source?.lineNumber}
            {findSourceSiblings().length > 0 && (
              <span
                style={{ color: "#60a5fa", marginLeft: 4 }}
                title="This element is rendered in a loop — edits apply to all instances"
              >
                {"\u00d7"}{findSourceSiblings().length + 1} instances
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => selected.openInEditor()}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#94a3b8",
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              cursor: "pointer"
            }}
            title="Open in IDE"
          >
            IDE
          </button>
        </div>
      </div>

      {/* className editor — simple textarea for string literals, multi-part for expressions */}
      {selected.source?.classNameParts?.length > 0 ? (
        <ClassNamePartsEditor
          parts={selected.source.classNameParts}
          selected={selected}
          editor={editor}
          debugLog={debugLog}
        />
      ) : (
        <>
          <div
            style={{
              fontSize: 10,
              color: "#64748b",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600
            }}
          >
            className
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => applyLive(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            style={{
              width: "100%",
              background: "#0c1222",
              border: hasChanges ? "1px solid #3b82f6" : "1px solid #1e293b",
              color: "#e2e8f0",
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              padding: "6px 8px",
              borderRadius: 6,
              outline: "none",
              resize: "none",
              minHeight: 36,
              lineHeight: "18px",
              boxSizing: "border-box",
              transition: "border-color 150ms"
            }}
            placeholder="No classes"
          />
        </>
      )}

      {/* Class tags preview */}
      {classes.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 3,
            marginTop: 6
          }}
        >
          {classes.map((cls, i) => {
            // Color-code by Tailwind category
            const color = getTailwindColor(cls)
            // Detect conflicts (same Tailwind group used twice)
            const group = getTailwindGroup(cls)
            const conflictIdx = group
              ? classes.findIndex(
                  (other, j) => j !== i && getTailwindGroup(other) === group
                )
              : -1
            const hasConflict = conflictIdx !== -1 && conflictIdx < i

            return (
              <span
                key={i}
                style={{
                  fontSize: 10,
                  fontFamily: "ui-monospace, monospace",
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: hasConflict ? "#7f1d1d20" : color.bg,
                  color: hasConflict ? "#fca5a5" : color.text,
                  border: `1px solid ${hasConflict ? "#ef4444" : color.border}`,
                  cursor: "pointer",
                  lineHeight: "16px",
                  textDecoration: hasConflict ? "line-through" : "none"
                }}
                title={
                  hasConflict
                    ? `Conflict: "${cls}" is overridden by "${classes[conflictIdx]}" (same CSS property). Click to remove.`
                    : `Click to remove "${cls}"`
                }
                onClick={() => {
                  const newClasses = classes.filter((_, j) => j !== i)
                  applyLive(newClasses.join(" "))
                }}
              >
                {cls}
                {hasConflict && (
                  <span style={{ marginLeft: 2, fontSize: 8 }}>{"\u26a0"}</span>
                )}
                <span style={{ opacity: 0.4, marginLeft: 3 }}>{"\u00d7"}</span>
              </span>
            )
          })}
        </div>
      )}

      {/* Conflict warning */}
      {(() => {
        const conflicts = findConflicts(classes)
        if (conflicts.length === 0) return null
        return (
          <div
            style={{
              marginTop: 4,
              padding: "4px 6px",
              background: "#7f1d1d15",
              border: "1px solid #ef444430",
              borderRadius: 4,
              fontSize: 10,
              color: "#fca5a5",
              lineHeight: "15px"
            }}
          >
            {conflicts.map((c, i) => (
              <div key={i}>
                <strong>{c.loser}</strong> is overridden by{" "}
                <strong>{c.winner}</strong> — remove one
              </div>
            ))}
          </div>
        )
      })()}

      {/* Keyboard hint */}
      <div
        style={{
          fontSize: 9,
          color: "#475569",
          marginTop: 6,
          display: "flex",
          gap: 8
        }}
      >
        <span>
          <kbd style={kbdStyle}>{"\u2318"}S</kbd> save
        </span>
        <span>
          <kbd style={kbdStyle}>Esc</kbd> revert
        </span>
      </div>

      {/* Save bar */}
      {hasChanges && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid #1e293b",
            display: "flex",
            gap: 4,
            flexDirection: "column"
          }}
        >
          <button
            onClick={save}
            disabled={isSaving}
            style={{
              background: "#3b82f6",
              border: "none",
              color: "#fff",
              fontSize: 11,
              padding: "5px 10px",
              borderRadius: 5,
              cursor: "pointer",
              fontWeight: 600,
              opacity: isSaving ? 0.6 : 1,
              width: "100%"
            }}
          >
            {isSaving ? "Saving\u2026" : "Save to source"}
          </button>

          {matchingElements.length > 0 && (
            <button
              onClick={applyToAll}
              disabled={isSaving}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#94a3b8",
                fontSize: 10,
                padding: "4px 8px",
                borderRadius: 5,
                cursor: "pointer",
                width: "100%"
              }}
            >
              Apply to all {matchingElements.length + 1} matching elements
            </button>
          )}

          <button
            onClick={() => applyLive(savedClassName)}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              fontSize: 10,
              padding: "2px 0",
              cursor: "pointer",
              textAlign: "center"
            }}
          >
            Revert changes
          </button>
        </div>
      )}

      {/* Other props (collapsed by default) */}
      <OtherProps selected={selected} editor={editor} />
    </div>
  )
}

// ─── Other Props (secondary) ─────────────────────────────────────────

function OtherProps({
  selected,
  editor
}: {
  selected: EditableElement
  editor: Editor
}) {
  const [expanded, setExpanded] = useState(false)
  const props = { ...selected.currentProps }
  delete props._source
  delete props.__component
  delete props.children
  delete props.className // Already shown above

  const propKeys = Object.keys(props).filter(
    (k) => k !== "ref" && k !== "key" && k !== "id" && typeof props[k] !== "function"
  )

  // Detect which props are dynamic (differ across sibling instances from same source line)
  const dynamicProps = new Set<string>()
  if (selected.source?.lineNumber) {
    const allEls = Object.values(editor.store.getState().elements) as EditableElement[]
    const siblings = allEls.filter(
      (e) =>
        e.id !== selected.id &&
        e.source?.lineNumber === selected.source?.lineNumber &&
        e.source?.columnNumber === selected.source?.columnNumber &&
        e.source?.fileName === selected.source?.fileName
    )
    for (const key of propKeys) {
      for (const sib of siblings) {
        const sibVal = sib.currentProps?.[key]
        const selVal = props[key]
        if (sibVal !== selVal) {
          // Values differ across instances → this prop is dynamic (from loop variable)
          dynamicProps.add(key)
          break
        }
      }
    }
  }

  if (propKeys.length === 0) return null

  return (
    <div style={{ marginTop: 8 }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          fontSize: 10,
          color: "#475569",
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 4
        }}
      >
        <span style={{ fontSize: 8 }}>{expanded ? "\u25bc" : "\u25b6"}</span>
        Other props ({propKeys.length})
      </div>
      {expanded && (
        <div style={{ marginTop: 4 }}>
          {propKeys.map((key) => {
            const value = props[key]
            const isDynamic = dynamicProps.has(key)
            const isObj = typeof value === "object" && value !== null
            const displayValue = isObj
              ? JSON.stringify(value, null, 1)
              : String(value ?? "")
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  fontSize: 11,
                  fontFamily: "ui-monospace, monospace",
                  padding: "3px 0",
                  gap: 6,
                  borderBottom: "1px solid #1e293b"
                }}
              >
                <span
                  style={{
                    color: isDynamic ? "#a78bfa" : "#64748b",
                    minWidth: 60,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 3
                  }}
                >
                  {isDynamic && (
                    <span
                      title="Dynamic prop — value comes from a loop variable or expression. Changes here only affect this instance at runtime."
                      style={{ fontSize: 9, cursor: "help" }}
                    >
                      {"\u21bb"}
                    </span>
                  )}
                  {key}
                </span>
                {isDynamic && isObj ? (
                  // Expression/object view for dynamic props
                  <details style={{ flex: 1, overflow: "hidden" }}>
                    <summary
                      style={{
                        color: "#a78bfa",
                        cursor: "pointer",
                        fontSize: 10,
                        listStyle: "none"
                      }}
                    >
                      {"{expression}"} — {Object.keys(value).length} fields
                    </summary>
                    <pre
                      style={{
                        color: "#94a3b8",
                        fontSize: 10,
                        margin: "2px 0 0 0",
                        padding: "4px 6px",
                        background: "#0c1222",
                        borderRadius: 4,
                        overflow: "auto",
                        maxHeight: 120,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all"
                      }}
                    >
                      {displayValue}
                    </pre>
                  </details>
                ) : (
                  <span
                    style={{
                      color: isDynamic
                        ? "#a78bfa"
                        : typeof value === "string"
                        ? "#86efac"
                        : typeof value === "number"
                        ? "#93c5fd"
                        : "#e2e8f0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1
                    }}
                    title={isDynamic ? `Dynamic: ${displayValue}` : displayValue}
                  >
                    {typeof value === "string"
                      ? `"${displayValue}"`
                      : displayValue}
                    {isDynamic && (
                      <span
                        style={{
                          fontSize: 9,
                          color: "#64748b",
                          marginLeft: 4
                        }}
                      >
                        (dynamic)
                      </span>
                    )}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tailwind conflict detection ─────────────────────────────────────

/** Map a Tailwind class to its CSS property group for conflict detection.
 *  Returns group prefixed with variant context so dark:bg-red-100 and bg-red-100
 *  don't conflict (they apply in different contexts). */
function getTailwindGroup(cls: string): string | null {
  // Extract variant prefixes (sm:, hover:, dark:, etc.)
  const prefixMatch = cls.match(/^((?:sm:|md:|lg:|xl:|2xl:|hover:|focus:|active:|dark:|group-|peer-)+)/)
  const prefix = prefixMatch ? prefixMatch[1] : ""
  const base = cls.slice(prefix.length)

  let group: string | null = null

  if (/^rounded(-|$)/.test(base)) group = "border-radius"
  else if (/^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents|table|flow-root)$/.test(base)) group = "display"
  else if (/^(static|relative|absolute|fixed|sticky)$/.test(base)) group = "position"
  else if (/^w-/.test(base)) group = "width"
  else if (/^h-/.test(base)) group = "height"
  else if (/^max-w-/.test(base)) group = "max-width"
  else if (/^min-w-/.test(base)) group = "min-width"
  else if (/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/.test(base)) group = "font-size"
  else if (/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(base)) group = "font-weight"
  else if (/^text-(left|center|right|justify|start|end)$/.test(base)) group = "text-align"
  else if (/^bg-(transparent|current|white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)/.test(base)) group = "background-color"
  else if (/^text-(transparent|current|white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)/.test(base)) group = "text-color"
  else if (/^p-/.test(base) && !/^p[xytblr]-/.test(base)) group = "padding"
  else if (/^px-/.test(base)) group = "padding-x"
  else if (/^py-/.test(base)) group = "padding-y"
  else if (/^pt-/.test(base)) group = "padding-top"
  else if (/^pb-/.test(base)) group = "padding-bottom"
  else if (/^pl-/.test(base)) group = "padding-left"
  else if (/^pr-/.test(base)) group = "padding-right"
  else if (/^m-/.test(base) && !/^m[xytblr]-/.test(base)) group = "margin"
  else if (/^mx-/.test(base)) group = "margin-x"
  else if (/^my-/.test(base)) group = "margin-y"
  else if (/^gap-/.test(base)) group = "gap"
  else if (/^justify-/.test(base)) group = "justify-content"
  else if (/^items-/.test(base)) group = "align-items"
  else if (/^flex-(row|col)/.test(base)) group = "flex-direction"
  else if (/^overflow-/.test(base) && !/^overflow-[xy]-/.test(base)) group = "overflow"
  else if (/^shadow(-|$)/.test(base)) group = "box-shadow"
  else if (/^opacity-/.test(base)) group = "opacity"
  else if (/^z-/.test(base)) group = "z-index"
  else if (/^cursor-/.test(base)) group = "cursor"

  // Prefix with variant context so dark:bg-red-100 and bg-red-100
  // are different groups (they apply in different CSS contexts)
  return group ? prefix + group : null
}

/** Find pairs of conflicting classes. */
function findConflicts(classes: string[]): { winner: string; loser: string }[] {
  const conflicts: { winner: string; loser: string }[] = []
  const seen = new Map<string, number>()

  for (let i = 0; i < classes.length; i++) {
    const group = getTailwindGroup(classes[i])
    if (!group) continue
    const prevIdx = seen.get(group)
    if (prevIdx !== undefined) {
      // In Tailwind's generated CSS, the utility order is fixed.
      // The EARLIER class in the source className string is the one that
      // gets overridden, because Tailwind's stylesheet order determines
      // specificity, not class attribute order. But with CDN/JIT, the
      // last-encountered variant wins. We flag the second occurrence as
      // the "intended" one and the first as overridden.
      conflicts.push({
        winner: classes[i],
        loser: classes[prevIdx]
      })
    }
    seen.set(group, i)
  }

  return conflicts
}

// ─── Tailwind class coloring ─────────────────────────────────────────

function getTailwindColor(cls: string): {
  bg: string
  text: string
  border: string
} {
  // Layout
  if (/^(flex|grid|block|inline|hidden|container|columns|aspect)/.test(cls))
    return { bg: "#1e1b4b10", text: "#a78bfa", border: "#a78bfa30" }
  // Spacing
  if (/^(p[xytblr]?-|m[xytblr]?-|gap-|space-)/.test(cls))
    return { bg: "#14532d10", text: "#86efac", border: "#86efac30" }
  // Sizing
  if (/^(w-|h-|min-|max-|size-)/.test(cls))
    return { bg: "#0c4a6e10", text: "#7dd3fc", border: "#7dd3fc30" }
  // Typography
  if (/^(text-|font-|leading-|tracking-|truncate|uppercase|lowercase|capitalize|italic|underline|line-clamp)/.test(cls))
    return { bg: "#78350f10", text: "#fbbf24", border: "#fbbf2430" }
  // Background / color
  if (/^(bg-|from-|via-|to-|gradient)/.test(cls))
    return { bg: "#3b0f0f10", text: "#fca5a5", border: "#fca5a530" }
  // Border / ring / outline
  if (/^(border|ring|outline|rounded|divide|shadow)/.test(cls))
    return { bg: "#1e293b20", text: "#94a3b8", border: "#94a3b840" }
  // Position / z-index
  if (/^(absolute|relative|fixed|sticky|top-|right-|bottom-|left-|inset-|z-)/.test(cls))
    return { bg: "#4c1d9510", text: "#c4b5fd", border: "#c4b5fd30" }
  // Transition / animation
  if (/^(transition|duration|ease|delay|animate)/.test(cls))
    return { bg: "#831843", text: "#f9a8d4", border: "#f9a8d430" }
  // Responsive / state prefixes
  if (/^(sm:|md:|lg:|xl:|2xl:|hover:|focus:|active:|dark:|group-|peer-)/.test(cls))
    return { bg: "#0f172a", text: "#60a5fa", border: "#60a5fa40" }
  // Overflow / display
  if (/^(overflow|cursor|opacity|visible|invisible|pointer-events|select)/.test(cls))
    return { bg: "#1e293b20", text: "#cbd5e1", border: "#cbd5e140" }

  // Default
  return { bg: "#1e293b15", text: "#94a3b8", border: "#334155" }
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0 3px",
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 3,
  fontSize: 9,
  fontFamily: "ui-monospace, monospace",
  lineHeight: "14px",
  color: "#64748b"
}

// ─── Main Editor Panel ───────────────────────────────────────────────

export function EditorPanel({ editor }: { editor: Editor }) {
  const [activeTab, setActiveTab] = useState<"classes" | "tree">("classes")
  const [, forceUpdate] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [pos, setPos] = useState({ x: 12, y: 12 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  // Drag-to-reposition on title bar
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPos({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy
      })
    }
    function onUp() {
      dragRef.current = null
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [])

  useEffect(() => {
    const sub = editor.service.subscribe(() => forceUpdate((n) => n + 1))
    return () => sub.unsubscribe()
  }, [editor])

  const elements = editor.store.getState().elements
  const rootElements = Object.values(elements).filter((el) => !el.parentId)
  const selected = editor.selectedElement

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "5px 0",
    border: "none",
    background: active ? "#1e293b" : "transparent",
    color: active ? "#e2e8f0" : "#64748b",
    fontSize: 10,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
    textTransform: "uppercase",
    letterSpacing: "0.05em"
  })

  return (
    <>
      <SelectionOverlay editor={editor} />
      <HoverOverlay editor={editor} />

      <div
        data-editor-panel
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          width: collapsed ? 36 : 300,
          maxHeight: "calc(100vh - 24px)",
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          zIndex: 100000,
          fontFamily: "'Inter', system-ui, sans-serif",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          transition: "width 150ms ease"
        }}
      >
        {/* Title bar — drag handle */}
        <div
          onPointerDown={(e) => {
            dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: collapsed ? "6px" : "6px 10px",
            borderBottom: collapsed ? "none" : "1px solid #1e293b",
            background: "#0f172a",
            cursor: "grab",
            userSelect: "none"
          }}
        >
          {!collapsed && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#e2e8f0",
                letterSpacing: "0.02em"
              }}
            >
              Editor
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              fontSize: 12,
              padding: 2,
              lineHeight: 1
            }}
          >
            {collapsed ? "\u25c0" : "\u25b6"}
          </button>
        </div>

        {!collapsed && (
          <>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #1e293b" }}>
              <button
                onClick={() => setActiveTab("classes")}
                style={tabStyle(activeTab === "classes")}
              >
                Classes
              </button>
              <button
                onClick={() => setActiveTab("tree")}
                style={tabStyle(activeTab === "tree")}
              >
                Tree
              </button>
            </div>

            {/* Content */}
            <div style={{ overflow: "auto", maxHeight: "calc(100vh - 110px)" }}>
              {activeTab === "classes" ? (
                selected ? (
                  <ClassNameEditor
                    key={selected.id}
                    editor={editor}
                    selected={selected}
                  />
                ) : (
                  <div
                    style={{
                      padding: 20,
                      color: "#475569",
                      fontSize: 12,
                      textAlign: "center",
                      lineHeight: "20px"
                    }}
                  >
                    Click any element to edit its classes
                  </div>
                )
              ) : (
                <div style={{ padding: "4px 0" }}>
                  {rootElements.map((el) => (
                    <TreeNode key={el.id} element={el} editor={editor} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
