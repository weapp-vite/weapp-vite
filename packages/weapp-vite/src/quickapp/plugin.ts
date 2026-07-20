import type { Plugin } from 'vite'
import type { ResolvedQuickAppConfig } from './types'
import { readFile } from 'node:fs/promises'
import path from 'pathe'
import {
  compileQuickAppVueFile,
  QUICKAPP_VUE_RUNTIME_FILE,
  quickAppVueRuntimeSource,
} from './compiler'
import { collectQuickAppFiles } from './files'
import { validateQuickAppSourceSemantics } from './validate'

const QUICKAPP_ENTRY_ID = 'virtual:weapp-vite-quickapp-entry'
const RESOLVED_QUICKAPP_ENTRY_ID = `\0${QUICKAPP_ENTRY_ID}`
const MINI_PROGRAM_SOURCE_EXTENSIONS = new Set(['.wxml', '.wxss', '.wxs'])

function toOutputPath(root: string, filePath: string) {
  return path.relative(root, filePath).replaceAll('\\', '/')
}

async function validateQuickAppSource(config: ResolvedQuickAppConfig, sourceFiles: string[]) {
  const relativeFiles = new Set(sourceFiles.map(filePath => toOutputPath(config.srcDir, filePath)))
  if (!relativeFiles.has('manifest.json')) {
    throw new Error('QuickApp 项目必须提供 src/manifest.json，当前目标不会从 app.json 转换。')
  }
  if (!relativeFiles.has('app.ux')) {
    throw new Error('QuickApp 项目必须提供原生 src/app.ux；Vue SFC 当前仅用于页面和组件。')
  }
  if (relativeFiles.has('app.json')) {
    throw new Error('QuickApp 目标不支持把微信小程序 app.json 转换为 manifest.json。')
  }
  const miniProgramSource = sourceFiles.find(filePath => MINI_PROGRAM_SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
  if (miniProgramSource) {
    throw new Error(`QuickApp 目标不支持转换小程序模板或样式：${toOutputPath(config.srcDir, miniProgramSource)}`)
  }

  const manifestPath = path.resolve(config.srcDir, 'manifest.json')
  try {
    JSON.parse(await readFile(manifestPath, 'utf8'))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`QuickApp manifest.json 不是合法 JSON：${message}`)
  }
  await validateQuickAppSourceSemantics(config.srcDir, sourceFiles)
}

export function createQuickAppPlugin(config: ResolvedQuickAppConfig): Plugin {
  return {
    name: 'weapp-vite:quickapp',
    enforce: 'pre',
    resolveId(id) {
      if (id === QUICKAPP_ENTRY_ID) {
        return RESOLVED_QUICKAPP_ENTRY_ID
      }
    },
    load(id) {
      if (id === RESOLVED_QUICKAPP_ENTRY_ID) {
        return 'export {}'
      }
    },
    async buildStart() {
      const sourceFiles = await collectQuickAppFiles(config.srcDir)
      await validateQuickAppSource(config, sourceFiles)
      const outputPaths = new Set<string>()
      let hasVueFiles = false

      for (const filePath of sourceFiles) {
        const relativePath = toOutputPath(config.srcDir, filePath)
        const outputPath = relativePath.endsWith('.vue')
          ? `${relativePath.slice(0, -4)}.ux`
          : relativePath
        if (outputPaths.has(outputPath)) {
          throw new Error(`QuickApp 输出路径冲突：${outputPath}`)
        }
        outputPaths.add(outputPath)
        this.addWatchFile(filePath)
        const source = await readFile(filePath)
        const outputSource = relativePath.endsWith('.vue')
          ? (await compileQuickAppVueFile(source.toString('utf8'), filePath, config.srcDir)).code
          : source
        hasVueFiles ||= relativePath.endsWith('.vue')
        this.emitFile({
          type: 'asset',
          fileName: `src/${outputPath}`,
          source: outputSource,
        })
      }

      if (hasVueFiles) {
        if (outputPaths.has(QUICKAPP_VUE_RUNTIME_FILE)) {
          throw new Error(`QuickApp Vue 运行时输出路径冲突：${QUICKAPP_VUE_RUNTIME_FILE}`)
        }
        this.emitFile({
          type: 'asset',
          fileName: `src/${QUICKAPP_VUE_RUNTIME_FILE}`,
          source: quickAppVueRuntimeSource,
        })
      }

      for (const filePath of await collectQuickAppFiles(config.testDir)) {
        this.addWatchFile(filePath)
        this.emitFile({
          type: 'asset',
          fileName: `test/${toOutputPath(config.testDir!, filePath)}`,
          source: await readFile(filePath),
        })
      }

      this.emitFile({
        type: 'asset',
        fileName: 'package.json',
        source: `${JSON.stringify({ name: 'weapp-vite-quickapp-output', private: true }, null, 2)}\n`,
      })
    },
    generateBundle(_options, bundle) {
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'chunk' && output.facadeModuleId === RESOLVED_QUICKAPP_ENTRY_ID) {
          delete bundle[fileName]
        }
      }
    },
  }
}

export { QUICKAPP_ENTRY_ID }
