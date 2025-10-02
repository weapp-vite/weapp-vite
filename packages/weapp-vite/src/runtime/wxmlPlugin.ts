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
  const depsMap = new Map<string, Set<string>>()
  const tokenMap = new Map<string, ScanWxmlResult>()
  const wxmlComponentsMap = new Map<string, ComponentsMap>()

  async function addDeps(filepath: string, deps: string[] = []) {
    if (!depsMap.has(filepath)) {
      const set = new Set<string>()
      for (const dep of deps) {
        set.add(dep)
      }
      depsMap.set(filepath, set)
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
    depsMap.clear()
    tokenMap.clear()
    wxmlComponentsMap.clear()
  }

  function analyze(wxml: string) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before scanning wxml')
    }
    return scanWxml(wxml, {
      platform: ctx.configService.platform,
      ...(
        ctx.configService.weappViteConfig?.enhance?.wxml === true
          ? {}
          : ctx.configService.weappViteConfig?.enhance?.wxml),
    })
  }

  async function scan(filepath: string) {
    if (!ctx.configService) {
      throw new Error('configService must be initialized before scanning wxml')
    }
    if (await fs.exists(filepath)) {
      const dirname = path.dirname(filepath)
      const wxml = await fs.readFile(filepath, 'utf8')
      const res = analyze(wxml)

      tokenMap.set(filepath, res)
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
      wxmlComponentsMap.set(removeExtensionDeep(absPath), components)
    }
  }

  return {
    depsMap,
    tokenMap,
    wxmlComponentsMap,
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
