import type { Plugin, ResolvedConfig } from 'vite'
import type { CompilerContext } from '../../context'
import type { WeappReactConfig } from '../../types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { transformWithOxc } from 'vite'
import { baseTemplate } from './baseTemplate'
import { compileStaticReactPage } from './staticTemplate/index'

export const REACT_PLUGIN_NAME = 'weapp-vite:react'
const REACT_FILE_RE = /\.(?:jsx|tsx)(?:\?.*)?$/

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
  const staticTemplates = new Map<string, string>()
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
      staticTemplates.delete(fileName)
      return
    }
    try {
      const source = await readFile(cleanId, 'utf8')
      staticTemplates.set(fileName, compileStaticReactPage(source, cleanId).template)
    }
    catch (error) {
      staticTemplates.delete(fileName)
      if (reactConfig.renderMode === 'static') {
        throw error
      }
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
      if (resolved.renderMode !== 'dynamic') {
        try {
          const compiled = compileStaticReactPage(source, id)
          const fileName = resolveStaticTemplateFileName(
            ctx.configService?.cwd ?? process.cwd(),
            id,
          )
          staticTemplates.set(fileName, compiled.template)
          transformedSource = compiled.code
        }
        catch (error) {
          staticTemplates.delete(resolveStaticTemplateFileName(
            ctx.configService?.cwd ?? process.cwd(),
            id,
          ))
          if (resolved.renderMode === 'static') {
            throw error
          }
          if (resolved.devWarnings && error instanceof Error) {
            this.warn(`[react] dynamic island fallback for ${id}: ${error.message}`)
          }
        }
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
      for (const [fileName, source] of staticTemplates) {
        const existing = bundle[fileName]
        if (existing?.type === 'asset') {
          existing.source = source
        }
        else {
          this.emitFile({ type: 'asset', fileName, source })
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
