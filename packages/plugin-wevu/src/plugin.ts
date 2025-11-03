import type { Logger, Plugin as VitePlugin } from 'vite'
import fg from 'fast-glob'
import fs from 'fs-extra'
import path from 'pathe'
import { compileWevuSfc } from './compiler'

interface EmitRecord {
  script?: string
  template?: string
  style?: string
  config?: string
}

export interface WevuPluginOptions {
  include?: string[]
  /**
   * When provided, emit compiled assets under this root (relative to project root).
   */
  outputRoot?: string
}

const VUE_GLOB = '**/*.vue'
const DEFAULT_IGNORES = ['**/node_modules/**', '**/.git/**', '**/dist/**']
const PLUGIN_NAME = '@weapp-vite/plugin-wevu'

function ensureTrailingNewline(code: string) {
  return code.endsWith('\n') ? code : `${code}\n`
}

function resolveScriptExtension(lang?: string) {
  if (!lang) {
    return 'js'
  }
  if (lang === 'ts' || lang === 'tsx') {
    return 'ts'
  }
  return 'js'
}

function resolveStyleExtension(lang?: string) {
  if (!lang || lang === 'css') {
    return 'wxss'
  }
  return lang
}

function isVueFile(id: string) {
  return id.endsWith('.vue')
}

export function wevuPlugin(options: WevuPluginOptions = {}): VitePlugin {
  const emitted = new Map<string, EmitRecord>()
  const roots = new Set<string>()
  const rootEmitMap = new Map<string, string | undefined>()
  let logger: Logger | undefined
  let isCleaningAll = false
  let projectRoot = path.resolve()
  let outputBase: string | undefined

  const logError = (message: string) => {
    if (logger) {
      logger.error(message)
      return
    }
    const globalConsole = globalThis.console
    if (globalConsole && typeof globalConsole.error === 'function') {
      globalConsole.error(message)
    }
  }

  function belongsToRoots(id: string) {
    for (const rootDir of roots) {
      if (id === rootDir || id.startsWith(`${rootDir}${path.sep}`)) {
        return true
      }
    }
    return false
  }

  function getRootForFile(id: string) {
    for (const rootDir of roots) {
      if (id === rootDir || id.startsWith(`${rootDir}${path.sep}`)) {
        return rootDir
      }
    }
    return undefined
  }

  async function cleanupStaleEmits(file: string, next: EmitRecord) {
    const previous = emitted.get(file)
    if (!previous) {
      return
    }

    const previousFiles = Object.values(previous).filter(Boolean)
    const nextFiles = new Set(Object.values(next).filter(Boolean))

    await Promise.all(
      previousFiles.map(async (filepath) => {
        if (!filepath || nextFiles.has(filepath)) {
          return
        }
        try {
          await fs.remove(filepath)
        }
        catch {
          // ignore cleanup failures
        }
      }),
    )
  }

  async function removeEmitted(file: string) {
    const previous = emitted.get(file)
    if (!previous) {
      return
    }
    emitted.delete(file)
    await Promise.all(
      Object.values(previous)
        .filter(Boolean)
        .map(async (filepath) => {
          if (!filepath) {
            return
          }
          try {
            await fs.remove(filepath)
          }
          catch {
            // ignore cleanup failures
          }
        }),
    )
  }

  async function cleanupAllEmits() {
    if (isCleaningAll) {
      return
    }
    isCleaningAll = true
    try {
      const records = Array.from(emitted.values())
      emitted.clear()
      const files = records.flatMap(record => Object.values(record).filter(Boolean))
      await Promise.all(
        files.map(async (filepath) => {
          if (!filepath) {
            return
          }
          try {
            await fs.remove(filepath)
          }
          catch {
            // ignore cleanup failures
          }
        }),
      )
    }
    finally {
      isCleaningAll = false
    }
  }

  async function compileFile(file: string) {
    try {
      const result = await compileWevuSfc({ filename: file })
      const record: EmitRecord = {}
      const rootDir = getRootForFile(file)
      const emitRoot = rootDir ? rootEmitMap.get(rootDir) : undefined
      const relativeDir = rootDir ? path.relative(rootDir, path.dirname(file)) : ''
      const safeRelativeDir = relativeDir && !relativeDir.startsWith('..') ? relativeDir : ''
      const directory = emitRoot ? path.join(emitRoot, safeRelativeDir) : path.dirname(file)
      const basename = path.basename(file, path.extname(file))

      if (result.script?.code.trim()) {
        const ext = resolveScriptExtension(result.script.lang)
        const scriptPath = path.join(directory, `${basename}.${ext}`)
        await fs.outputFile(scriptPath, ensureTrailingNewline(result.script.code))
        record.script = scriptPath
      }

      if (result.template?.code.trim()) {
        const templatePath = path.join(directory, `${basename}.wxml`)
        await fs.outputFile(templatePath, ensureTrailingNewline(result.template.code))
        record.template = templatePath
      }

      if (result.style?.code.trim()) {
        const ext = resolveStyleExtension(result.style.lang)
        const stylePath = path.join(directory, `${basename}.${ext}`)
        await fs.outputFile(stylePath, ensureTrailingNewline(result.style.code))
        record.style = stylePath
      }

      if (result.config?.code.trim()) {
        const configPath = path.join(directory, `${basename}.json`)
        await fs.outputFile(configPath, `${result.config.code.trim()}\n`)
        record.config = configPath
      }

      await cleanupStaleEmits(file, record)
      emitted.set(file, record)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logError(`[plugin-wevu] Failed to compile ${file}: ${message}`)
    }
  }

  async function compileAll() {
    if (!roots.size) {
      return
    }
    const patterns = Array.from(roots).map(rootDir => fg(VUE_GLOB, {
      cwd: rootDir,
      absolute: true,
      ignore: DEFAULT_IGNORES,
    }))
    const results = await Promise.all(patterns)
    const files = new Set(results.flat())
    await Promise.all(Array.from(files).map(file => compileFile(file)))
  }

  function handleFileChange(id: string) {
    if (!isVueFile(id) || !belongsToRoots(id)) {
      return
    }
    void compileFile(id)
  }

  return {
    name: PLUGIN_NAME,
    async configResolved(config) {
      logger = config.logger
      projectRoot = config.root ? path.resolve(config.root) : path.resolve()
      roots.clear()
      rootEmitMap.clear()
      outputBase = options.outputRoot ? path.resolve(projectRoot, options.outputRoot) : undefined
      if (outputBase) {
        await fs.ensureDir(outputBase)
      }
      const weappOptions = (config as any).weapp ?? {}

      const registerRoot = async (input: string | undefined) => {
        if (!input) {
          return
        }
        const abs = path.resolve(projectRoot, input)
        if (roots.has(abs)) {
          return
        }
        roots.add(abs)
        if (outputBase && !abs.startsWith(outputBase)) {
          const relative = path.relative(projectRoot, abs)
          const emitRoot = relative ? path.join(outputBase, relative) : outputBase
          rootEmitMap.set(abs, emitRoot)
          await fs.ensureDir(emitRoot)
        }
        else {
          rootEmitMap.set(abs, undefined)
        }
      }

      await registerRoot(weappOptions.srcRoot ?? '.')
      if (weappOptions.pluginRoot) {
        await registerRoot(weappOptions.pluginRoot)
      }
      for (const extra of options.include ?? []) {
        await registerRoot(extra)
      }
      await compileAll()
    },
    buildStart: compileAll,
    async watchChange(id, change) {
      if (!isVueFile(id) || !belongsToRoots(id)) {
        return
      }
      if (change.event === 'delete') {
        await removeEmitted(id)
        return
      }
      await compileFile(id)
    },
    configureServer(server) {
      const watcher = server.watcher
      const onChange = (id: string) => handleFileChange(id)
      watcher.on('add', onChange)
      watcher.on('change', onChange)
      watcher.on('unlink', async (id: string) => {
        if (!isVueFile(id) || !belongsToRoots(id)) {
          return
        }
        await removeEmitted(id)
      })
      const httpServer = server.httpServer
      if (httpServer) {
        httpServer.once('close', () => {
          void cleanupAllEmits()
        })
      }
    },
    async buildEnd(this: any) {
      if (this.meta.watchMode) {
        return
      }
      await cleanupAllEmits()
    },
    async closeBundle() {
      await cleanupAllEmits()
    },
  }
}
