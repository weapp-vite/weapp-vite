import type { JsxAutoComponentAnalysisOptions, JsxAutoComponentContext } from './types'
import {
  collectJsxAutoComponentsWithBabel,
  defaultResolveBabelComponentExpression,
  defaultResolveBabelRenderExpression,
} from './babel'
import { collectJsxAutoComponentsWithOxc } from './oxc'
import { defaultIsDefineComponentSource, mayContainJsxAutoComponentEntry } from './shared'

/**
 * 从 JSX 源码中收集自动 usingComponents 所需的导入组件与模板标签。
 */
export function collectJsxAutoComponentsFromCode(
  source: string,
  options: JsxAutoComponentAnalysisOptions,
): JsxAutoComponentContext {
  if (!mayContainJsxAutoComponentEntry(source)) {
    return {
      templateTags: new Set<string>(),
      importedComponents: [],
    }
  }

  const normalizedOptions = {
    astEngine: options.astEngine ?? 'babel',
    isCollectableTag: options.isCollectableTag,
    isDefineComponentSource: options.isDefineComponentSource ?? defaultIsDefineComponentSource,
    resolveBabelComponentExpression: options.resolveBabelComponentExpression ?? defaultResolveBabelComponentExpression,
    resolveBabelRenderExpression: options.resolveBabelRenderExpression ?? defaultResolveBabelRenderExpression,
  }

  try {
    return normalizedOptions.astEngine === 'oxc'
      ? collectJsxAutoComponentsWithOxc(source, normalizedOptions)
      : collectJsxAutoComponentsWithBabel(source, normalizedOptions)
  }
  catch {
    return {
      templateTags: new Set<string>(),
      importedComponents: [],
    }
  }
}

export * from './babel'
export * from './oxc'
export * from './shared'
export * from './types'
