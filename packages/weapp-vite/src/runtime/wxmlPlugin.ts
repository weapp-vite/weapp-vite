import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { ComponentsMap } from '../types'
import type { ScanWxmlResult } from '../wxml'
import { fs, removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { isEmptyObject } from '../context/shared'
import logger from '../logger'
import { isTemplate, toPosixPath } from '../utils'
import { isScriptModuleTagName } from '../utils/wxmlScriptModule'
import { isTemplateImportTag, scanWxml } from '../wxml'
import { requireConfigService } from './utils/requireConfigService'

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

function createWxmlService(ctx: MutableCompilerContext): WxmlService {
  const {
    depsMap,
    importerMap,
    tokenMap,
    componentsMap,
    aggregatedComponentsMap,
    templatePathMap,
    cache,
    emittedCode,
  } = ctx.runtimeState.wxml
  // 自动导入专用组件索引缓存。
  // 这里会保留被内置组件过滤逻辑排除掉的标签，供 auto-import resolver 继续判断。
  const autoImportComponentsMap = new Map<string, ComponentsMap>()
  // 自动导入专用聚合缓存。
  // 与 aggregatedComponentsMap 分离，避免改动普通组件分析语义。
  const aggregatedAutoImportComponentsMap = new Map<string, ComponentsMap>()

  function linkImporter(dep: string, importer: string) {
    let importers = importerMap.get(dep)
    if (!importers) {
      importers = new Set<string>()
      importerMap.set(dep, importers)
    }
    importers.add(importer)
  }

  function unlinkImporter(dep: string, importer: string) {
    const importers = importerMap.get(dep)
    if (!importers) {
      return
    }
    importers.delete(importer)
    if (importers.size === 0) {
      importerMap.delete(dep)
    }
  }

  function invalidateAggregatedComponents(
    filepath: string,
    targetMap: Map<string, ComponentsMap>,
    visited = new Set<string>(),
  ) {
    if (visited.has(filepath)) {
      return
    }
    visited.add(filepath)
    targetMap.delete(removeExtensionDeep(filepath))
    const importers = importerMap.get(filepath)
    if (!importers) {
      return
    }
    for (const importer of importers) {
      invalidateAggregatedComponents(importer, targetMap, visited)
    }
  }

  async function setDeps(filepath: string, deps: string[] = []) {
    const nextDeps = new Set<string>(deps)
    const previousDeps = depsMap.get(filepath) ?? new Set<string>()
    const nextDepsKey = Array.from(nextDeps).sort().join('\0')
    const previousDepsKey = Array.from(previousDeps).sort().join('\0')

    for (const previousDep of previousDeps) {
      if (!nextDeps.has(previousDep)) {
        unlinkImporter(previousDep, filepath)
      }
    }

    for (const dep of nextDeps) {
      linkImporter(dep, filepath)
    }

    depsMap.set(filepath, nextDeps)
    if (nextDepsKey !== previousDepsKey) {
      invalidateAggregatedComponents(filepath, aggregatedComponentsMap)
      invalidateAggregatedComponents(filepath, aggregatedAutoImportComponentsMap)
    }
    await Promise.all(
      Array.from(nextDeps)
        .filter(dep => isTemplate(dep))
        .map((dep) => {
          // eslint-disable-next-line ts/no-use-before-define -- 递归扫描依赖模板，需要复用下方 scan 实现
          return scan(dep)
        }),
    )
  }

  async function addDeps(filepath: string, deps: string[] = []) {
    const currentDeps = depsMap.get(filepath) ?? new Set<string>()
    await setDeps(filepath, [...currentDeps, ...deps])
  }

  function resolveDepPath(filepath: string, value: string) {
    const configService = requireConfigService(ctx, '解析 WXML 依赖前必须初始化 configService。')
    const dirname = path.dirname(filepath)
    if (value.startsWith('/')) {
      return path.resolve(configService.absoluteSrcRoot, value.slice(1))
    }
    return path.resolve(dirname, value)
  }

  function collectDepsFromToken(filepath: string, deps: ScanWxmlResult['deps'] = []) {
    return deps
      .filter((dep) => {
        if (!dep.value) {
          return false
        }
        if (isTemplateImportTag(dep.tagName)) {
          return isTemplate(dep.value)
        }
        return isScriptModuleTagName(dep.tagName)
      })
      .map(dep => resolveDepPath(filepath, dep.value))
  }

  function getImporters(filepath: string) {
    return new Set(importerMap.get(filepath) ?? [])
  }

  function getAllDeps() {
    const set = new Set<string>()
    for (const [key, value] of depsMap) {
      set.add(key)
      for (const item of value) {
        set.add(item)
      }
    }
    return set
  }

  function resolveTemplatePath(filepathOrBaseName: string) {
    if (depsMap.has(filepathOrBaseName) || tokenMap.has(filepathOrBaseName)) {
      return filepathOrBaseName
    }
    if (templatePathMap.has(filepathOrBaseName)) {
      return templatePathMap.get(filepathOrBaseName)
    }
    return undefined
  }

  function getAggregatedComponents(filepathOrBaseName: string) {
    const templatePath = resolveTemplatePath(filepathOrBaseName)
    if (!templatePath) {
      return undefined
    }

    const baseName = removeExtensionDeep(templatePath)
    const cached = aggregatedComponentsMap.get(baseName)
    if (cached) {
      return cached
    }

    const visited = new Set<string>()
    const aggregate = (filepath: string): ComponentsMap => {
      if (visited.has(filepath)) {
        return {}
      }
      visited.add(filepath)

      const currentBaseName = removeExtensionDeep(filepath)
      const merged: ComponentsMap = {}
      // 常规聚合只读取普通组件索引，因此不会把宿主内置标签带进 usingComponents 推断结果。
      const own = componentsMap.get(currentBaseName)
      if (own) {
        for (const [name, ranges] of Object.entries(own)) {
          merged[name] = ranges
        }
      }

      const deps = depsMap.get(filepath)
      if (deps) {
        for (const dep of deps) {
          if (!isTemplate(dep)) {
            continue
          }
          const depComponents = aggregate(dep)
          for (const [name, ranges] of Object.entries(depComponents)) {
            if (!merged[name]) {
              merged[name] = ranges
            }
          }
        }
      }

      aggregatedComponentsMap.set(currentBaseName, merged)
      return merged
    }

    return aggregate(templatePath)
  }

  function getAggregatedAutoImportComponents(filepathOrBaseName: string) {
    const templatePath = resolveTemplatePath(filepathOrBaseName)
    if (!templatePath) {
      return undefined
    }

    const baseName = removeExtensionDeep(templatePath)
    const cached = aggregatedAutoImportComponentsMap.get(baseName)
    if (cached) {
      return cached
    }

    const visited = new Set<string>()
    const aggregate = (filepath: string): ComponentsMap => {
      if (visited.has(filepath)) {
        return {}
      }
      visited.add(filepath)

      const currentBaseName = removeExtensionDeep(filepath)
      const merged: ComponentsMap = {}
      // 自动导入优先读取完整标签索引。
      // 老缓存场景下如果还没有 autoImportComponentsMap，则回退到普通组件索引，保证兼容性。
      const own = autoImportComponentsMap.get(currentBaseName) ?? componentsMap.get(currentBaseName)
      if (own) {
        for (const [name, ranges] of Object.entries(own)) {
          merged[name] = ranges
        }
      }

      const deps = depsMap.get(filepath)
      if (deps) {
        for (const dep of deps) {
          if (!isTemplate(dep)) {
            continue
          }
          const depComponents = aggregate(dep)
          for (const [name, ranges] of Object.entries(depComponents)) {
            if (!merged[name]) {
              merged[name] = ranges
            }
          }
        }
      }

      aggregatedAutoImportComponentsMap.set(currentBaseName, merged)
      return merged
    }

    return aggregate(templatePath)
  }

  function clearAll(options?: { clearEmittedCode?: boolean }) {
    const clearEmittedCode = options?.clearEmittedCode !== false
    const currentRoot = ctx.configService?.currentSubPackageRoot
    if (!currentRoot) {
      depsMap.clear()
      importerMap.clear()
      tokenMap.clear()
      componentsMap.clear()
      aggregatedComponentsMap.clear()
      autoImportComponentsMap.clear()
      aggregatedAutoImportComponentsMap.clear()
      templatePathMap.clear()
      cache.cache.clear()
      cache.mtimeMap.clear()
      cache.signatureMap.clear()
      if (clearEmittedCode) {
        emittedCode.clear()
      }
      return
    }

    const shouldClear = (absPath: string) => {
      const relative = ctx.configService!.relativeAbsoluteSrcRoot(absPath)
      return relative.startsWith(`${currentRoot}/`)
    }

    for (const key of Array.from(depsMap.keys())) {
      if (shouldClear(key)) {
        const depSet = depsMap.get(key)
        if (depSet) {
          for (const dep of depSet) {
            unlinkImporter(dep, key)
          }
        }
        depsMap.delete(key)
        continue
      }

      const depSet = depsMap.get(key)
      if (depSet) {
        for (const dep of Array.from(depSet)) {
          if (shouldClear(dep)) {
            unlinkImporter(dep, key)
            depSet.delete(dep)
          }
        }
      }
    }

    for (const key of Array.from(importerMap.keys())) {
      if (shouldClear(key)) {
        importerMap.delete(key)
      }
    }

    for (const key of Array.from(tokenMap.keys())) {
      if (shouldClear(key)) {
        tokenMap.delete(key)
      }
    }

    for (const key of Array.from(componentsMap.keys())) {
      if (shouldClear(key)) {
        componentsMap.delete(key)
      }
    }

    for (const key of Array.from(aggregatedComponentsMap.keys())) {
      if (shouldClear(key)) {
        aggregatedComponentsMap.delete(key)
      }
    }

    for (const key of Array.from(autoImportComponentsMap.keys())) {
      if (shouldClear(key)) {
        autoImportComponentsMap.delete(key)
      }
    }

    for (const key of Array.from(aggregatedAutoImportComponentsMap.keys())) {
      if (shouldClear(key)) {
        aggregatedAutoImportComponentsMap.delete(key)
      }
    }

    for (const [key, value] of Array.from(templatePathMap.entries())) {
      if (shouldClear(key) || shouldClear(value)) {
        templatePathMap.delete(key)
      }
    }

    for (const key of Array.from(cache.cache.keys())) {
      if (shouldClear(key)) {
        cache.delete(key)
      }
    }

    for (const key of Array.from(cache.mtimeMap.keys())) {
      if (shouldClear(key)) {
        cache.mtimeMap.delete(key)
      }
    }

    if (clearEmittedCode) {
      for (const key of Array.from(emittedCode.keys())) {
        const normalized = toPosixPath(key)
        if (normalized === currentRoot || normalized.startsWith(`${currentRoot}/`)) {
          emittedCode.delete(key)
        }
      }
    }
  }

  function analyze(wxml: string) {
    const configService = requireConfigService(ctx, '扫描 WXML 前必须初始化 configService。')
    const wxmlConfig = configService.weappViteConfig?.wxml ?? configService.weappViteConfig?.enhance?.wxml
    return scanWxml(wxml, {
      platform: configService.platform,
      ...(
        wxmlConfig === true
          ? {}
          : wxmlConfig),
    })
  }

  async function scan(filepath: string) {
    const configService = requireConfigService(ctx, '扫描 WXML 前必须初始化 configService。')

    let stat: { mtimeMs?: number, ctimeMs?: number, size?: number }
    try {
      stat = await fs.stat(filepath)
    }
    catch (error: any) {
      if (error && error.code === 'ENOENT') {
        logger.warn(`引用模板 \`${configService.relativeCwd(filepath)}\` 不存在!`)
        return
      }
      throw error
    }

    const signature = `${stat.mtimeMs ?? ''}:${stat.ctimeMs ?? ''}:${stat.size ?? ''}`
    const shouldRescan = await cache.isInvalidate(filepath, { signature, checkMtime: false })
    if (!shouldRescan) {
      const cached = cache.get(filepath)
      if (cached) {
        tokenMap.set(filepath, cached)
        return cached
      }
    }

    const wxml = await fs.readFile(filepath, 'utf8')
    const res = analyze(wxml)
    tokenMap.set(filepath, res)
    cache.set(filepath, res)
    const baseName = removeExtensionDeep(filepath)
    // `autoImportComponents` 由单次 parse 同步产出，避免为自动导入单独再扫描一次 WXML。
    const autoImportComponentEntries = res.autoImportComponents ?? res.components ?? {}
    if (isEmptyObject(autoImportComponentEntries)) {
      autoImportComponentsMap.delete(baseName)
    }
    else {
      autoImportComponentsMap.set(baseName, autoImportComponentEntries)
    }
    invalidateAggregatedComponents(filepath, aggregatedAutoImportComponentsMap)
    await setDeps(filepath, collectDepsFromToken(filepath, res.deps))
    return res
  }

  function setWxmlComponentsMap(absPath: string, components: ComponentsMap) {
    const baseName = removeExtensionDeep(absPath)
    templatePathMap.set(baseName, absPath)
    if (isEmptyObject(components)) {
      componentsMap.delete(baseName)
    }
    else {
      componentsMap.set(baseName, components)
    }
    invalidateAggregatedComponents(absPath, aggregatedComponentsMap)
  }

  return {
    depsMap,
    importerMap,
    tokenMap,
    wxmlComponentsMap: componentsMap,
    aggregatedComponentsMap,
    addDeps,
    setDeps,
    collectDepsFromToken,
    getImporters,
    getAllDeps,
    getAggregatedComponents,
    getAggregatedAutoImportComponents,
    clearAll,
    analyze,
    scan,
    setWxmlComponentsMap,
  }
}

export function createWxmlServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createWxmlService(ctx)
  ctx.wxmlService = service

  return {
    name: 'weapp-runtime:wxml-service',
    buildStart() {
      service.clearAll({
        clearEmittedCode: !ctx.configService?.isDev,
      })
    },
  }
}
