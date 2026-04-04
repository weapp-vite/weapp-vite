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
  wxmlComponentsMap: Map<string, ComponentsMap>
  addDeps: (filepath: string, deps?: string[]) => Promise<void>
  setDeps: (filepath: string, deps?: string[]) => Promise<void>
  collectDepsFromToken: (filepath: string, deps?: ScanWxmlResult['deps']) => string[]
  getImporters: (filepath: string) => Set<string>
  getAllDeps: () => Set<string>
  clearAll: () => void
  analyze: (wxml: string) => ScanWxmlResult
  scan: (filepath: string) => Promise<ScanWxmlResult | undefined>
  setWxmlComponentsMap: (absPath: string, components: ComponentsMap) => void
}

function createWxmlService(ctx: MutableCompilerContext): WxmlService {
  const { depsMap, importerMap, tokenMap, componentsMap, cache, emittedCode } = ctx.runtimeState.wxml

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

  async function setDeps(filepath: string, deps: string[] = []) {
    const nextDeps = new Set<string>(deps)
    const previousDeps = depsMap.get(filepath) ?? new Set<string>()

    for (const previousDep of previousDeps) {
      if (!nextDeps.has(previousDep)) {
        unlinkImporter(previousDep, filepath)
      }
    }

    for (const dep of nextDeps) {
      linkImporter(dep, filepath)
    }

    depsMap.set(filepath, nextDeps)
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

  function clearAll() {
    const currentRoot = ctx.configService?.currentSubPackageRoot
    if (!currentRoot) {
      depsMap.clear()
      importerMap.clear()
      tokenMap.clear()
      componentsMap.clear()
      cache.cache.clear()
      cache.mtimeMap.clear()
      cache.signatureMap.clear()
      emittedCode.clear()
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

    for (const key of Array.from(emittedCode.keys())) {
      const normalized = toPosixPath(key)
      if (normalized === currentRoot || normalized.startsWith(`${currentRoot}/`)) {
        emittedCode.delete(key)
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
    await setDeps(filepath, collectDepsFromToken(filepath, res.deps))
    return res
  }

  function setWxmlComponentsMap(absPath: string, components: ComponentsMap) {
    if (!isEmptyObject(components)) {
      componentsMap.set(removeExtensionDeep(absPath), components)
    }
  }

  return {
    depsMap,
    importerMap,
    tokenMap,
    wxmlComponentsMap: componentsMap,
    addDeps,
    setDeps,
    collectDepsFromToken,
    getImporters,
    getAllDeps,
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
      service.clearAll()
    },
  }
}
