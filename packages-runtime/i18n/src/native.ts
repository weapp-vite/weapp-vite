import type { CompileNativeI18nOptions, CompileNativeI18nResult, I18nLocaleFileInput } from './types'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { compileI18nCatalog } from './catalog'
import { generateI18nCatalogModuleSource, generateI18nWxsSource } from './source'

async function collectLocaleFiles(root: string, files: string[]) {
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const filePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        await collectLocaleFiles(filePath, files)
      }
    }
    else if (entry.isFile() && path.basename(root) === 'i18n' && path.extname(entry.name) === '.json') {
      files.push(filePath)
    }
  }
}

export async function compileNativeI18n(
  options: CompileNativeI18nOptions,
): Promise<CompileNativeI18nResult> {
  const srcRoot = path.resolve(options.srcRoot)
  const outDir = path.resolve(options.outDir ?? path.join(srcRoot, 'i18n'))
  const files: string[] = []
  await collectLocaleFiles(srcRoot, files)
  files.sort()
  if (!files.length) {
    throw new Error(`未在 \`${srcRoot}\` 下找到 i18n/*.json locale 文件。`)
  }

  const inputs: I18nLocaleFileInput[] = []
  for (const filePath of files) {
    let messages: unknown
    try {
      messages = JSON.parse(await fs.readFile(filePath, 'utf8'))
    }
    catch (error) {
      throw new Error(`无法解析 i18n 文件 \`${filePath}\`：${String(error)}`)
    }
    inputs.push({
      filePath,
      locale: path.basename(filePath, path.extname(filePath)),
      messages,
    })
  }

  const catalog = compileI18nCatalog(inputs, options)
  const jsFile = path.join(outDir, 'locales.js')
  const wxsFile = path.join(outDir, 'locales.wxs')
  await fs.mkdir(outDir, { recursive: true })
  await Promise.all([
    fs.writeFile(jsFile, generateI18nCatalogModuleSource(catalog), 'utf8'),
    fs.writeFile(wxsFile, generateI18nWxsSource(catalog), 'utf8'),
  ])
  return { catalog, files, jsFile, wxsFile }
}
