import type { LanguageOptions } from '@weapp-vite/language-service'
import type { OxfmtConfig } from 'vite-plus/fmt'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { STYLE_EXTENSIONS } from '@weapp-vite/language-service'
import { analyzeProject, collectProjectFiles, isNativeDocument } from '@weapp-vite/language-service/project'
import { nativeFormatIgnorePatterns, recommended } from '../index'
import { formatDocument } from '../languages'
import { resolveDocumentFormatOptions } from './config'

const STANDARD_FILE = /\.(?:[cm]?[jt]sx?|json[5c]?|css|scss|less|html?|vue|ya?ml|md|markdown|mdx|graphql|gql|toml|svelte|astro|hbs|handlebars)$/i

export interface FormatCandidate {
  file: string
  source: string
  formatted: string
}

/** 所有文件先在内存完成解析、方言和格式校验，再交给调用方一次提交。 */
export async function prepareFormatting(root: string, inputs: string[], config: OxfmtConfig, language: LanguageOptions): Promise<FormatCandidate[]> {
  const ignores = [...recommended.ignorePatterns, ...(config.ignorePatterns ?? [])].filter(pattern => !nativeFormatIgnorePatterns.includes(pattern))
  const files = await collectProjectFiles(root, inputs, ignores)
  const native = new Map((await analyzeProject(root, inputs, language, ignores)).map(document => [document.file, document]))
  const candidates: FormatCandidate[] = []
  for (const file of files) {
    const fileName = path.relative(root, file).split(path.sep).join('/')
    const settings = resolveDocumentFormatOptions(fileName, config)
    if (!isNativeDocument(file) && !STANDARD_FILE.test(file) && !STYLE_EXTENSIONS.some(extension => file.endsWith(extension)) && settings.fileName === fileName) {
      continue
    }
    const source = native.get(file)?.source ?? await readFile(file, 'utf8')
    const document = native.get(file)
    if (document && !document.analysis.valid) {
      throw new Error(document.analysis.diagnostics.filter(diagnostic => diagnostic.severity === 'error').map(diagnostic => `${fileName}:${diagnostic.start + 1}: ${diagnostic.message}`).join('\n'))
    }
    const formatted = await formatDocument(source, settings.fileName, { ...settings.options, ...language, ...(document ? { sourceKind: document.input.sourceKind, dialect: document.input.dialect, language: document.input.language } : {}), ...(document?.platform ? { platform: document.platform } : {}) })
    candidates.push({ file, source, formatted })
  }
  return candidates
}
