import type { CompilerContext } from '../../../context'
import type { SubPackageStyleEntry } from '../../../types'
import { fileURLToPath } from 'node:url'
import { objectHash } from '@weapp-core/shared'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'
import path from 'pathe'
import postcss from 'postcss'
import { cssPostProcess } from '../../../postcss'

interface LoadedPostcssConfig {
  plugins: postcss.AcceptedPlugin[]
  options: Record<string, any>
}

interface SassCompileResult {
  css: string
  loadedUrls?: Iterable<URL | string>
}

interface SassCompiler {
  compileAsync: (path: string, options?: Record<string, any>) => Promise<SassCompileResult>
}

interface LessRenderResult {
  css: string
  imports?: string[]
}

interface LessCompiler {
  render: (code: string, options?: Record<string, any>) => Promise<LessRenderResult>
}

interface StylusInstance {
  render: (callback: (err: any, output: string) => void) => void
  deps?: () => string[]
}

type StylusFactory = (code: string, options?: Record<string, any>) => StylusInstance

const CSS_LIKE_EXTENSIONS = new Set(['.css', '.pcss', '.postcss', '.sss'])
const SASS_EMBEDDED_PACKAGE_NAME: string = 'sass-embedded'
const SASS_PACKAGE_NAME: string = 'sass'
const LESS_PACKAGE_NAME: string = 'less'
const STYLUS_PACKAGE_NAME: string = 'stylus'

export const cssCodeCache = new LRUCache<string, string>({
  max: 512,
})

const userPostcssConfigCache = new Map<string, Promise<LoadedPostcssConfig | null>>()

let sassCompilerPromise: Promise<SassCompiler | undefined> | undefined
let lessCompilerPromise: Promise<LessCompiler | undefined> | undefined
let stylusFactoryPromise: Promise<StylusFactory | undefined> | undefined

function isConfigNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  if (message.includes('No PostCSS Config found')) {
    return true
  }

  const code = (error as any).code
  if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
    const requireStack = (error as any).requireStack
    if (Array.isArray(requireStack) && requireStack.length === 0) {
      return true
    }
    return message.includes('postcss-load-config')
  }

  return false
}

async function loadSassCompiler(): Promise<SassCompiler | undefined> {
  if (!sassCompilerPromise) {
    sassCompilerPromise = (async () => {
      const tryResolve = async (id: string) => {
        try {
          const mod: any = await import(id)
          const compiler = mod?.compileAsync ? mod : mod?.default
          if (compiler?.compileAsync) {
            return compiler as SassCompiler
          }
        }
        catch {
          return undefined
        }
      }

      return (await tryResolve(SASS_EMBEDDED_PACKAGE_NAME)) ?? (await tryResolve(SASS_PACKAGE_NAME))
    })()
  }
  return await sassCompilerPromise
}

async function loadLessCompiler(): Promise<LessCompiler | undefined> {
  if (!lessCompilerPromise) {
    lessCompilerPromise = (async () => {
      try {
        const mod: any = await import(LESS_PACKAGE_NAME)
        const compiler = mod?.render ? mod : mod?.default
        if (compiler?.render) {
          return compiler as LessCompiler
        }
      }
      catch {
        return undefined
      }
      return undefined
    })()
  }
  return await lessCompilerPromise
}

async function loadStylusFactory(): Promise<StylusFactory | undefined> {
  if (!stylusFactoryPromise) {
    stylusFactoryPromise = (async () => {
      try {
        const mod: any = await import(STYLUS_PACKAGE_NAME)
        const factory = typeof mod === 'function' ? mod : mod?.default
        if (typeof factory === 'function') {
          return factory as StylusFactory
        }
      }
      catch {
        return undefined
      }
      return undefined
    })()
  }
  return await stylusFactoryPromise
}

async function loadUserPostcssConfig(
  cwd: string,
): Promise<LoadedPostcssConfig | null> {
  let promise = userPostcssConfigCache.get(cwd)
  if (!promise) {
    promise = (async () => {
      try {
        const mod: any = await import('postcss-load-config')
        const loader = typeof mod === 'function'
          ? mod
          : typeof mod?.default === 'function'
            ? mod.default
            : mod?.loadConfig
        if (typeof loader !== 'function') {
          return null
        }
        const result = await loader({}, cwd)
        const plugins = Array.isArray(result.plugins)
          ? result.plugins
          : []
        const options = { ...(result.options ?? {}) }
        return { plugins, options }
      }
      catch (error) {
        if (isConfigNotFoundError(error)) {
          return null
        }
        throw error
      }
    })()
    userPostcssConfigCache.set(cwd, promise)
  }
  return await promise
}

export async function processCssWithCache(
  code: string,
  configService: CompilerContext['configService'],
): Promise<string> {
  const cacheKey = objectHash({
    code,
    options: { platform: configService.platform },
  })
  let processed = cssCodeCache.get(cacheKey)
  if (!processed) {
    processed = await cssPostProcess(code, { platform: configService.platform })
    cssCodeCache.set(cacheKey, processed)
  }
  return processed
}

function dedupeAndNormalizeDependencies(base: string, dependencies: Iterable<string | undefined>): string[] {
  const seen = new Set<string>()
  const baseDir = path.dirname(base)
  for (const dep of dependencies) {
    if (!dep) {
      continue
    }
    const normalized = path.isAbsolute(dep) ? dep : path.resolve(baseDir, dep)
    seen.add(normalized)
  }
  return Array.from(seen)
}

async function applyUserPostcss(
  css: string,
  absolutePath: string,
  configService: CompilerContext['configService'],
): Promise<string> {
  const loadedConfig = await loadUserPostcssConfig(configService.cwd)
  if (!loadedConfig || !loadedConfig.plugins.length) {
    return css
  }

  const result = await postcss(loadedConfig.plugins).process(css, {
    ...loadedConfig.options,
    from: absolutePath,
    map: false,
  })
  return result.css
}

export interface PreprocessedStyleResult {
  css: string
  dependencies: string[]
}

export async function renderSharedStyleEntry(
  entry: SubPackageStyleEntry,
  configService: CompilerContext['configService'],
): Promise<PreprocessedStyleResult> {
  const ext = entry.inputExtension
  const absolutePath = entry.absolutePath

  try {
    if (ext === '.wxss') {
      const css = await fs.readFile(absolutePath, 'utf8')
      const transformed = await applyUserPostcss(css, absolutePath, configService)
      return {
        css: transformed,
        dependencies: [],
      }
    }

    if (CSS_LIKE_EXTENSIONS.has(ext)) {
      const css = await fs.readFile(absolutePath, 'utf8')
      const transformed = await applyUserPostcss(css, absolutePath, configService)
      return {
        css: transformed,
        dependencies: [],
      }
    }

    if (ext === '.scss' || ext === '.sass') {
      const compiler = await loadSassCompiler()
      if (!compiler) {
        throw new Error('未找到 Sass 编译器，请安装 `sass` 或 `sass-embedded`')
      }
      const result = await compiler.compileAsync(absolutePath, { style: 'expanded' })
      const dependencies = dedupeAndNormalizeDependencies(
        absolutePath,
        Array.from(result.loadedUrls ?? [], (url) => {
          try {
            if (typeof url === 'string') {
              return url.startsWith('file:') ? fileURLToPath(new URL(url)) : undefined
            }
            if (url instanceof URL) {
              return url.protocol === 'file:' ? fileURLToPath(url) : undefined
            }
          }
          catch {
            return undefined
          }
          return undefined
        }),
      )

      const transformed = await applyUserPostcss(result.css, absolutePath, configService)
      return {
        css: transformed,
        dependencies,
      }
    }

    if (ext === '.less') {
      const compiler = await loadLessCompiler()
      if (!compiler) {
        throw new Error('未找到 Less 编译器，请安装 `less`')
      }
      const source = await fs.readFile(absolutePath, 'utf8')
      const result = await compiler.render(source, { filename: absolutePath })
      const dependencies = result.imports ? dedupeAndNormalizeDependencies(absolutePath, result.imports) : []
      const transformed = await applyUserPostcss(result.css, absolutePath, configService)
      return {
        css: transformed,
        dependencies,
      }
    }

    if (ext === '.styl' || ext === '.stylus') {
      const stylusFactory = await loadStylusFactory()
      if (!stylusFactory) {
        throw new Error('未找到 Stylus 编译器，请安装 `stylus`')
      }
      const source = await fs.readFile(absolutePath, 'utf8')
      const renderer = stylusFactory(source, { filename: absolutePath })
      const css = await new Promise<string>((resolve, reject) => {
        renderer.render((err: any, output: string) => {
          if (err) {
            reject(err)
          }
          else {
            resolve(output)
          }
        })
      })
      const deps = typeof renderer.deps === 'function' ? renderer.deps() ?? [] : []
      const dependencies = dedupeAndNormalizeDependencies(absolutePath, deps)
      const transformed = await applyUserPostcss(css, absolutePath, configService)
      return {
        css: transformed,
        dependencies,
      }
    }

    const css = await fs.readFile(absolutePath, 'utf8')
    const transformed = await applyUserPostcss(css, absolutePath, configService)
    return {
      css: transformed,
      dependencies: [],
    }
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`[subpackages] 编译共享样式 \`${entry.source}\` 失败：${reason}`)
  }
}
