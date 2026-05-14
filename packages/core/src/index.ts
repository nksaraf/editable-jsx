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
  createExpressionField,
  inferActiveLiterals,
  type ExpressionChange,
  type ExpressionLiteral,
} from "./editor/expression-field.js"
