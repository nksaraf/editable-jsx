export type {
  BasePatch,
  HmrSuppressMap,
  SaveResult,
  SourceLocation,
} from "./types.js"

export type {
  EditableAttribute,
  EditableClassNamePart,
  EditableCSSProperty,
  EditableCSSVariable,
  EditableProp,
  EditableProperty,
  EditableText,
  ElementNode,
  FrameworkAdapter,
  PropertyChange,
} from "./element.js"

export { ComponentTree } from "./element.js"

export {
  createHotUpdateHandler,
  createSuppressMap,
  suppressFile,
} from "./hmr/suppress.js"

export { applyPatches, groupPatchesByFile } from "./patcher/orchestrate.js"

export {
  replaceAtOffset,
  replaceAtPosition,
  replaceNormalized,
  type ReplaceOptions,
} from "./patcher/text-patcher.js"

export {
  createPatchDispatcher,
  patchFramework,
  type AstroAttrPatch,
  type AstroExprPatch,
  type CSSPropertyPatch,
  type CSSVariablePatch,
  type JSXAttrPatch,
  type JSXClassNamePatch,
  type Patch,
  type PatchRouter,
  type TextPatch,
} from "./patcher/patch-types.js"

export {
  sourceResolver,
  type ResolvedSource,
  type SourceStrategy,
} from "./resolve/source-resolver.js"

export {
  createExpressionField,
  inferActiveLiterals,
  type ExpressionChange,
  type ExpressionLiteral,
} from "./editor/expression-field.js"

export { createClassEditor } from "./editor/class-editor.js"

export {
  createValueSourceIndicator,
  type ValueSource,
} from "./editor/value-source.js"
