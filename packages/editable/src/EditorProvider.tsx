import { EditorContext } from "./EditorContext"

export function EditorProvider({ editor, children }) {
  return (
    <EditorContext.Provider value={editor}>
      {children}
      {/* <SettingsProvider>
        <CommandManagerContext.Provider value={editor.commands}>
          <CommandBarContext.Provider value={editor.commandBar}>
            <PanelsProvider manager={editor.panels}></PanelsProvider>
          </CommandBarContext.Provider>
        </CommandManagerContext.Provider>
      </SettingsProvider> */}
    </EditorContext.Provider>
  )
}
