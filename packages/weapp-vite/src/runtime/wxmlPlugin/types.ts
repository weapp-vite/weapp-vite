import type { ComponentsMap } from '../../types'
import type { ScanWxmlResult } from '../../wxml'

export interface WxmlService {
  depsMap: Map<string, Set<string>>
  importerMap: Map<string, Set<string>>
  tokenMap: Map<string, ScanWxmlResult>
  /**
   * @description 常规组件索引缓存。
   * 这里沿用历史行为，只保留“应参与 usingComponents 推断”的组件标签。
   */
  wxmlComponentsMap: Map<string, ComponentsMap>
  /**
   * @description 常规组件聚合缓存。
   * 会递归合并 import/include 进来的模板组件，但仍遵循内置组件过滤规则。
   */
  aggregatedComponentsMap: Map<string, ComponentsMap>
  addDeps: (filepath: string, deps?: string[]) => Promise<void>
  setDeps: (filepath: string, deps?: string[]) => Promise<void>
  collectDepsFromToken: (filepath: string, deps?: ScanWxmlResult['deps']) => string[]
  getImporters: (filepath: string) => Set<string>
  getAllDeps: () => Set<string>
  getAggregatedComponents: (filepathOrBaseName: string) => ComponentsMap | undefined
  getAggregatedAutoImportComponents: (filepathOrBaseName: string) => ComponentsMap | undefined
  clearAll: (options?: { clearEmittedCode?: boolean }) => void
  analyze: (wxml: string) => ScanWxmlResult
  scan: (filepath: string) => Promise<ScanWxmlResult | undefined>
  setWxmlComponentsMap: (absPath: string, components: ComponentsMap) => void
}
