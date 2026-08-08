import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../../context'
import type { WeappReactConfig } from '../../types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { transformWithOxc } from 'vite'
import { baseTemplate } from './baseTemplate'
import {
  compileStaticReactPage,
  hasNativeComponentBridge,
  ReactNativeBridgeStaticError,
} from './staticTemplate/index'

export const REACT_PLUGIN_NAME = 'weapp-vite:react'
const REACT_FILE_RE = /\.(?:jsx|tsx)(?:\?.*)?$/

interface ReactTemplateAsset {
  nativeComponents: string[]
  source: string
}

function resolveStaticTemplateFileName(cwd: string, id: string) {
  const cleanId = id.split('?', 1)[0] ?? id
  const relative = path.relative(cwd, cleanId).replaceAll('\\', '/')
  let fileName = relative
    .replace(/\.(?:jsx|tsx)$/, '.wxml')
    .replace(/^src\//, '')
  if (fileName.endsWith('/view.wxml')) {
    fileName = fileName.replace(/\/view\.wxml$/, '/index.wxml')
  }
  return fileName
}

function createDynamicTemplate(fileName: string) {
  const relative = path.posix.relative(path.posix.dirname(fileName), 'runtime/base.wxml')
  const importPath = relative.startsWith('.') ? relative : `./${relative}`
  return `<import src="${importPath}" />\n<template is="react_root" data="{{root:root}}" />`
}

function resolveReactConfig(value: boolean | WeappReactConfig | undefined): WeappReactConfig | undefined {
  if (!value) {
    return undefined
  }
  return value === true ? {} : value
}

export function isReactEnabled(ctx: CompilerContext) {
  return Boolean(resolveReactConfig(ctx.configService?.weappViteConfig?.react))
}

export function resolveReactConfigValue(value: boolean | WeappReactConfig | undefined) {
  const config = resolveReactConfig(value)
  if (!config) {
    return undefined
  }
  return {
    compiler: config.compiler ?? false,
    renderMode: config.renderMode ?? 'auto',
    devWarnings: config.devWarnings ?? true,
  } as const
}

export function isReactStaticTemplateSource(
  value: boolean | WeappReactConfig | undefined,
  id: string,
) {
  const config = resolveReactConfigValue(value)
  return Boolean(
    config
    && config.renderMode !== 'dynamic'
    && REACT_FILE_RE.test(id)
    && !id.includes('/node_modules/'),
  )
}

async function transformWithSwc(source: string, id: string, compilationMode: 'infer' | 'syntax' | 'annotation' | 'all') {
  try {
    const { transform } = await import('@swc/core')
    const result = await transform(source, {
      filename: id,
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        target: 'es2020',
        transform: {
          react: { importSource: 'react', runtime: 'automatic' },
          reactCompiler: { compilationMode },
        },
      },
      module: { type: 'es6' },
      sourceMaps: true,
    })
    return { code: result.code, map: result.map }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      fallback: true as const,
      warning: `[react] React Compiler transform failed for ${id}; falling back to Oxc: ${message}`,
    }
  }
}

export function createReactPlugin(ctx: CompilerContext): Plugin[] {
  const resolved = resolveReactConfigValue(ctx.configService?.weappViteConfig?.react)
  if (!resolved) {
    return []
  }
  const reactConfig = resolved

  let config: ResolvedConfig | undefined
  const templates = new Map<string, ReactTemplateAsset>()
  async function refreshStaticTemplate(
    id: string,
    event: 'create' | 'delete' | 'update',
    warn: (message: string) => void,
  ) {
    if (!isReactStaticTemplateSource(reactConfig, id)) {
      return
    }
    const cleanId = id.split('?', 1)[0] ?? id
    const fileName = resolveStaticTemplateFileName(ctx.configService?.cwd ?? process.cwd(), cleanId)
    if (event === 'delete') {
      templates.delete(fileName)
      return
    }
    try {
      const source = await readFile(cleanId, 'utf8')
      const compiled = compileStaticReactPage(source, cleanId)
      templates.set(fileName, {
        nativeComponents: compiled.nativeComponents,
        source: compiled.template,
      })
    }
    catch (error) {
      if (error instanceof ReactNativeBridgeStaticError) {
        throw error
      }
      if (reactConfig.renderMode === 'static') {
        throw error
      }
      templates.set(fileName, {
        nativeComponents: [],
        source: createDynamicTemplate(fileName),
      })
      if (reactConfig.devWarnings && error instanceof Error) {
        warn(`[react] dynamic island fallback for ${cleanId}: ${error.message}`)
      }
    }
  }
  return [{
    name: REACT_PLUGIN_NAME,
    enforce: 'pre',
    configResolved(next) {
      config = next
    },
    async watchChange(id, change) {
      await refreshStaticTemplate(id, change.event, message => this.warn(message))
    },
    async handleHotUpdate(context) {
      await refreshStaticTemplate(context.file, 'update', message => this.warn(message))
    },
    transform: async function transformReact(source, id) {
      if (!REACT_FILE_RE.test(id) || id.includes('/node_modules/')) {
        return null
      }

      let transformedSource = source
      const fileName = resolveStaticTemplateFileName(
        ctx.configService?.cwd ?? process.cwd(),
        id,
      )
      if (resolved.renderMode === 'dynamic' && hasNativeComponentBridge(source)) {
        throw new Error(`[react] ${id} 使用了原生组件 bridge，renderMode: 'dynamic' 不支持自定义组件`)
      }
      if (resolved.renderMode !== 'dynamic') {
        try {
          const compiled = compileStaticReactPage(source, id)
          templates.set(fileName, {
            nativeComponents: compiled.nativeComponents,
            source: compiled.template,
          })
          transformedSource = compiled.code
        }
        catch (error) {
          if (resolved.renderMode === 'static' || error instanceof ReactNativeBridgeStaticError) {
            throw error
          }
          templates.set(fileName, {
            nativeComponents: [],
            source: createDynamicTemplate(fileName),
          })
          if (resolved.devWarnings && error instanceof Error) {
            this.warn(`[react] dynamic island fallback for ${id}: ${error.message}`)
          }
        }
      }
      else {
        templates.set(fileName, {
          nativeComponents: [],
          source: createDynamicTemplate(fileName),
        })
      }

      const useCompiler = resolved.compiler !== false
      if (useCompiler) {
        const compilerConfig = typeof resolved.compiler === 'object' ? resolved.compiler : {}
        const result = await transformWithSwc(
          transformedSource,
          id,
          compilerConfig.compilationMode ?? 'infer',
        )
        if (!result.fallback) {
          return result
        }
        if (resolved.devWarnings !== false) {
          this.warn(result.warning)
        }
      }

      return await transformWithOxc(transformedSource, id, {
        jsx: {
          importSource: 'react',
          runtime: 'automatic',
        },
        lang: 'tsx',
        sourcemap: Boolean(config?.command === 'serve'),
      })
    },
    generateBundle(_options, bundle) {
      for (const [fileName, template] of templates) {
        if (template.nativeComponents.length > 0) {
          const jsonFileName = fileName.replace(/\.wxml$/, '.json')
          const jsonAsset = bundle[jsonFileName]
          if (jsonAsset?.type !== 'asset') {
            throw new Error(`[react] ${fileName} 使用了原生组件 bridge，但缺少对应配置 ${jsonFileName}`)
          }
          let json: Record<string, unknown>
          try {
            json = JSON.parse(String(jsonAsset.source)) as Record<string, unknown>
          }
          catch (error) {
            throw new Error(`[react] 无法解析原生组件配置 ${jsonFileName}`, { cause: error })
          }
          const usingComponents = json.usingComponents
          const registered = usingComponents && typeof usingComponents === 'object' && !Array.isArray(usingComponents)
            ? usingComponents as Record<string, unknown>
            : {}
          const missing = template.nativeComponents.filter(tag => typeof registered[tag] !== 'string')
          if (missing.length > 0) {
            throw new Error(`[react] ${fileName} 的原生组件 bridge 未在 ${jsonFileName} 的 usingComponents 注册：${missing.join(', ')}`)
          }
        }
        const existing = bundle[fileName]
        if (existing?.type === 'asset') {
          existing.source = template.source
        }
        else {
          this.emitFile({ type: 'asset', fileName, source: template.source })
        }
      }
      if (resolved.renderMode !== 'static' && !bundle['runtime/base.wxml']) {
        this.emitFile({
          type: 'asset',
          fileName: 'runtime/base.wxml',
          source: baseTemplate,
        })
      }
    },
  }]
}
