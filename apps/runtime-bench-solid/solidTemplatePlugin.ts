import type { Plugin } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { compileJsxFile } from 'wevu/compiler'

export interface SolidTemplatePluginOptions {
  templates: string[]
}

export async function compileSolidTemplate(source: string, filename: string) {
  const warnings: string[] = []
  const result = await compileJsxFile(source, filename, {
    isPage: true,
    warn: warning => warnings.push(warning),
  })
  if (!result.template) {
    throw new Error(`[solid-poc] ${filename} 未生成 WXML template`)
  }
  return { template: result.template, warnings }
}

function resolveOutputFile(template: string) {
  return template.replace(/\/template\.tsx$/, '/index.wxml')
}

export function solidTemplatePlugin(options: SolidTemplatePluginOptions): Plugin {
  const templates = new Map<string, string>()
  let root = process.cwd()

  return {
    name: 'runtime-bench:solid-template',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    async buildStart() {
      templates.clear()
      for (const relativeFile of options.templates) {
        const file = path.resolve(root, 'src', relativeFile)
        const source = await fs.readFile(file, 'utf8')
        const result = await compileSolidTemplate(source, file)
        for (const warning of result.warnings) {
          this.warn(warning)
        }
        templates.set(resolveOutputFile(relativeFile), result.template)
      }
    },
    generateBundle(_options, bundle) {
      for (const [fileName, source] of templates) {
        const existing = bundle[fileName]
        if (existing?.type === 'asset') {
          existing.source = source
        }
        else {
          this.emitFile({ type: 'asset', fileName, source })
        }
      }
    },
  }
}
