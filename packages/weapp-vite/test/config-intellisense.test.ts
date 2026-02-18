import path from 'node:path'
import ts from 'typescript'

function normalizeFileKey(filePath: string) {
  const normalized = filePath.replaceAll('\\', '/')
  return ts.sys.useCaseSensitiveFileNames ? normalized : normalized.toLowerCase()
}

function createLanguageService(options: {
  fileName: string
  source: string
  root: string
}) {
  const files = new Map([[normalizeFileKey(options.fileName), options.source]])

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    baseUrl: options.root,
    paths: {
      'weapp-vite/config': ['src/config.ts'],
      '@/*': ['src/*'],
    },
  }

  const languageServiceHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => [options.fileName],
    getScriptVersion: () => '1',
    getScriptSnapshot: (targetFileName) => {
      const inMemorySource = files.get(normalizeFileKey(targetFileName))
      const text = inMemorySource ?? ts.sys.readFile(targetFileName)
      if (text == null) {
        return undefined
      }
      return ts.ScriptSnapshot.fromString(text)
    },
    getCurrentDirectory: () => process.cwd(),
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
    fileExists: targetFileName => files.has(normalizeFileKey(targetFileName)) || ts.sys.fileExists(targetFileName),
    readFile: targetFileName => files.get(normalizeFileKey(targetFileName)) ?? ts.sys.readFile(targetFileName),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  }

  return ts.createLanguageService(languageServiceHost)
}

function getTokenPosition(source: string, token: string) {
  const position = source.indexOf(`${token}:`)
  if (position < 0) {
    throw new Error(`无法在测试源码中找到字段 ${token}`)
  }
  return position + 1
}

describe('defineConfig editor intellisense', () => {
  const root = path.resolve(__dirname, '..')
  const fileName = path.join(root, 'test/__virtual__/vite.config.ts')
  const source = [
    'import { defineConfig } from \'weapp-vite/config\'',
    'export default defineConfig(() => ({',
    '  weapp: {',
    '    srcRoot: \'src\',',
    '    autoImportComponents: {',
    '      vueComponents: true,',
    '    },',
    '  },',
    '}))',
  ].join('\n')

  it('should resolve config property definitions to types file', () => {
    const languageService = createLanguageService({ fileName, source, root })

    for (const key of ['srcRoot', 'autoImportComponents', 'vueComponents']) {
      const position = getTokenPosition(source, key)
      const definitions = languageService.getDefinitionAtPosition(fileName, position)
      expect(definitions?.[0]?.fileName).toContain('packages/weapp-vite/src/types/config.ts')
    }
  })

  it('should provide hover docs from WeappViteConfig', () => {
    const languageService = createLanguageService({ fileName, source, root })
    const position = getTokenPosition(source, 'srcRoot')

    const quickInfo = languageService.getQuickInfoAtPosition(fileName, position)
    const display = ts.displayPartsToString(quickInfo?.displayParts ?? [])
    const docs = ts.displayPartsToString(quickInfo?.documentation ?? [])

    expect(display).toContain('WeappViteConfig.srcRoot')
    expect(docs).toContain('应用入口目录')
  })
})
