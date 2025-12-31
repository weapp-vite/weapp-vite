import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { ComponentsMap } from '../types'
import type { ScanWxmlResult } from '../wxml'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import { isEmptyObject } from '../context/shared'
import logger from '../logger'
import { isTemplate } from '../utils'
import { isImportTag, scanWxml } from '../wxml'

export interface WxmlService {
  depsMap: Map<string, Set<string>>
  tokenMap: Map<string, ScanWxmlResult>
  wxmlComponentsMap: Map<string, ComponentsMap>
  addDeps: (filepath: string, deps?: string[]) => Promise<void>
  getAllDeps: () => Set<string>
  clearAll: () => void
  analyze: (wxml: string) => ScanWxmlResult
  scan: (filepath: string) => Promise<ScanWxmlResult | undefined>
  setWxmlComponentsMap: (absPath: string, components: ComponentsMap) => void
}

function createWxmlService(ctx: MutableCompilerContext): WxmlService {
  const { depsMap, tokenMap, componentsMap, cache, emittedCode } = ctx.runtimeState.wxml

  async function addDeps(filepath: string, deps: string[] = []) {
    if (!depsMap.has(filepath)) {
      const set = new Set<string>()
      for (const dep of deps) {
        set.add(dep)
      }
      depsMap.set(filepath, set)
      // eslint-disable-next-line ts/no-use-before-define -- 互相递归依赖，确保子依赖能被扫描到
      await Promise.all(deps.map(dep => scan(dep)))
    }
    else {
      const setRef = depsMap.get(filepath)
      if (setRef) {
        for (const dep of deps) {
          setRef.add(dep)
        }
      }
    }
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
        depsMap.delete(key)
        continue
      }

      const depSet = depsMap.get(key)
      if (depSet) {
        for (const dep of Array.from(depSet)) {
          if (shouldClear(dep)) {
            depSet.delete(dep)
          }
        }
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
      const normalized = key.replace(/\\/g, '/')
      if (normalized === currentRoot || normalized.startsWith(`${currentRoot}/`)) {
        emittedCode.delete(key)
      }
    }
  }

  function analyze(wxml: string) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before scanning wxml')
    }
    const wxmlConfig = ctx.configService.weappViteConfig?.wxml ?? ctx.configService.weappViteConfig?.enhance?.wxml
    return scanWxml(wxml, {
      platform: ctx.configService.platform,
      ...(
        wxmlConfig === true
          ? {}
          : wxmlConfig),
    })
  }

  async function scan(filepath: string) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before scanning wxml')
    }
    if (await fs.exists(filepath)) {
      const dirname = path.dirname(filepath)
      const wxml = await fs.readFile(filepath, 'utf8')
      const shouldRescan = await cache.isInvalidate(filepath, { content: wxml })
      if (!shouldRescan) {
        const cached = cache.get(filepath)
        if (cached) {
          tokenMap.set(filepath, cached)
          return cached
        }
      }
      const res = analyze(wxml)

      tokenMap.set(filepath, res)
      cache.set(filepath, res)
      await addDeps(
        filepath,
        res.deps.filter(x => isImportTag(x.tagName) && isTemplate(x.value)).map((x) => {
          if (x.value.startsWith('/')) {
            return path.resolve(ctx.configService!.absoluteSrcRoot, x.value.slice(1))
          }
          else {
            return path.resolve(dirname, x.value)
          }
        }),
      )
      return res
    }
    else {
      logger.warn(`引用模板 \`${ctx.configService.relativeCwd(filepath)}\` 不存在!`)
    }
  }

  function setWxmlComponentsMap(absPath: string, components: ComponentsMap) {
    if (!isEmptyObject(components)) {
      componentsMap.set(removeExtensionDeep(absPath), components)
    }
  }

  return {
    depsMap,
    tokenMap,
    wxmlComponentsMap: componentsMap,
    addDeps,
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
