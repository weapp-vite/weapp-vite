import process from 'node:process'
import { createLanguage } from '@volar/language-core'
import { createProxyLanguageService, decorateLanguageServiceHost } from '@volar/typescript'
import { createVueLanguagePlugin } from '@vue/language-core'
import ts from 'typescript'
import { createTestVueCompilerOptions } from './compilerOptions'

const vueCompilerOptions = createTestVueCompilerOptions()

export function normalizeFileName(fileName: string) {
  return fileName.replace(/\\/g, '/')
}

export function createVueLanguageService(files: Map<string, string>) {
  const normalizedFiles = new Map(
    [...files].map(([fileName, content]) => [normalizeFileName(fileName), content]),
  )
  const compilerOptions: ts.CompilerOptions = {
    allowNonTsExtensions: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ESNext,
  }
  const languagePlugin = createVueLanguagePlugin<string>(
    ts,
    compilerOptions,
    vueCompilerOptions,
    id => id,
  )
  const language = createLanguage(
    [languagePlugin],
    new Map(),
    (id) => {
      const normalizedId = normalizeFileName(id)
      const content = normalizedFiles.get(normalizedId) ?? ts.sys.readFile(normalizedId)
      if (content !== undefined) {
        language.scripts.set(
          normalizedId,
          ts.ScriptSnapshot.fromString(content),
          normalizedId.endsWith('.vue') ? 'vue' : 'typescript',
        )
      }
    },
  )

  const host: ts.LanguageServiceHost = {
    fileExists(fileName) {
      const normalizedFileName = normalizeFileName(fileName)
      return normalizedFiles.has(normalizedFileName) || ts.sys.fileExists(normalizedFileName)
    },
    getCompilationSettings: () => compilerOptions,
    getCurrentDirectory: () => process.cwd(),
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
    getScriptFileNames: () => [...normalizedFiles.keys()],
    getScriptSnapshot(fileName) {
      const normalizedFileName = normalizeFileName(fileName)
      const content = normalizedFiles.get(normalizedFileName) ?? ts.sys.readFile(normalizedFileName)
      return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content)
    },
    getScriptVersion: () => '0',
    readDirectory: ts.sys.readDirectory,
    readFile(fileName) {
      const normalizedFileName = normalizeFileName(fileName)
      return normalizedFiles.get(normalizedFileName) ?? ts.sys.readFile(normalizedFileName)
    },
    resolveModuleNameLiterals(moduleLiterals, containingFile, redirectedReference, options) {
      return moduleLiterals.map(moduleLiteral => ts.resolveModuleName(
        moduleLiteral.text,
        containingFile,
        options,
        host,
        undefined,
        redirectedReference,
      ))
    },
  }
  decorateLanguageServiceHost(ts, language, host)
  const languageService = ts.createLanguageService(host)
  const { proxy, initialize } = createProxyLanguageService(languageService)
  initialize(language)
  return proxy
}

export function findOffset(source: string, text: string, occurrence = 0) {
  let offset = -1
  for (let index = 0; index <= occurrence; index += 1) {
    offset = source.indexOf(text, offset + 1)
  }
  if (offset < 0) {
    throw new Error(`Unable to find ${JSON.stringify(text)} occurrence ${occurrence}`)
  }
  return offset
}
