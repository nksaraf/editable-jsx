import { Canvas as FiberCanvas } from "@react-three/fiber"
import "cmdk/dist/"
import { DrafterProvider } from "draft-n-draw"
import { ComponentProps, forwardRef, useMemo, useState } from "react"
import { Toaster } from "react-hot-toast"
import { EditableElementContext } from "../editable/editable"
import { EditorContext } from "../editable/Editor"
import { client } from "../vite/client"
import { CameraGizmos } from "./controls/CameraGizmos"
import {
  CommandBar,
  CommandBarControls
} from "./controls/CommandBar/CommandBar"
import { Commands } from "./controls/CommandBar/Commands"
import { EditorCamera } from "./controls/EditorCamera"
import { Panel } from "./controls/Panel"
import { PerformanceControls } from "./controls/PerformanceControls"
import { SceneControls } from "./controls/SceneControls"
import { SelectedElementControls } from "./controls/SelectedElementControls"
import { createMultiTunnel } from "./controls/tunnels"
import { DEFAULT_EDITOR_PLUGINS } from "./plugins"
import { ThreeEditor } from "./ThreeEditor"

export const editorTunnel = createMultiTunnel()

export const { In, Outs } = createMultiTunnel()

export const Editor = editorTunnel.In

export const Canvas = forwardRef<
  HTMLCanvasElement,
  ComponentProps<typeof FiberCanvas>
>(function Canvas({ children, ...props }, ref) {
  const store = useMemo(
    () => new ThreeEditor(DEFAULT_EDITOR_PLUGINS, client),
    []
  )

  // @ts-ignore
  window.editor = store

  return (
    <EditorContext.Provider value={store}>
      <Commands />
      <EditorCanvas ref={ref} store={store} {...props}>
        {children}
      </EditorCanvas>
      <Outs />
      <CommandBar />
      <Toaster />
    </EditorContext.Provider>
  )
})

const EditorCanvas = forwardRef<
  HTMLCanvasElement,
  {
    store: ThreeEditor
    children: any
  }
>(function EditorCanvas({ store, children, ...props }, ref) {
  const [settings] = store.useSettings("scene", {
    shadows: {
      value: true
    }
  })

  const [key, setKey] = useState(0)

  store.remount = () => {
    store.root.childIds = []
    setKey((k) => k + 1)
  }

  return (
    <FiberCanvas
      {...settings}
      ref={ref}
      onPointerMissed={(e) => {
        store.clearSelection()
      }}
      {...props}
    >
      <DrafterProvider>
        <EditorContext.Provider value={store}>
          <EditorCamera />
          <EditableElementContext.Provider key={key} value={store.root}>
            {children}
          </EditableElementContext.Provider>
          <editorTunnel.Outs
            fallback={
              <>
                <Panel
                  id="default"
                  title="properties"
                  collapsed={false}
                  pos="right"
                  width={280}
                />
                <Panel
                  id="scene"
                  title="scene"
                  pos="left"
                  width={280}
                  collapsed={false}
                />
                <SceneControls store="scene" />
                <SelectedElementControls store="default" />
                <PerformanceControls store="scene" />
                <CommandBarControls />
                <CameraGizmos />
              </>
            }
          />
        </EditorContext.Provider>
      </DrafterProvider>
    </FiberCanvas>
  )
})