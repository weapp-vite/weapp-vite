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
      'weapp-vite': ['src/config.ts'],
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
    'import { defineConfig } from \'weapp-vite\'',
    'export default defineConfig(() => ({',
    '  weapp: {',
    '    srcRoot: \'src\',',
    '    autoImportComponents: {',
    '      vueComponents: true,',
    '    },',
    '  },',
    '}))',
  ].join('\n')

  it('should provide hover info for WeappViteConfig fields', { timeout: 180_000 }, () => {
    const languageService = createLanguageService({ fileName, source, root })
    const position = getTokenPosition(source, 'srcRoot')

    const quickInfo = languageService.getQuickInfoAtPosition(fileName, position)
    const display = ts.displayPartsToString(quickInfo?.displayParts ?? [])

    expect(display).toContain('srcRoot')
    expect(display).toContain('string')
    languageService.dispose()
  })

  it('should contextually type destructured config env params', () => {
    const destructuredFileName = path.join(root, 'test/__virtual__/vite.destructured.config.ts')
    const destructuredSource = [
      'import { defineConfig } from \'weapp-vite\'',
      'export default defineConfig(({ mode }) => ({',
      '  weapp: {',
      '    srcRoot: mode,',
      '  },',
      '}))',
    ].join('\n')
    const languageService = createLanguageService({
      fileName: destructuredFileName,
      source: destructuredSource,
      root,
    })

    const diagnostics = languageService.getSemanticDiagnostics(destructuredFileName)
    expect(diagnostics).toEqual([])

    const modePosition = destructuredSource.indexOf('mode })') + 1
    const quickInfo = languageService.getQuickInfoAtPosition(destructuredFileName, modePosition)
    const display = ts.displayPartsToString(quickInfo?.displayParts ?? [])

    expect(display).toContain('mode: string')
    languageService.dispose()
  })

  it('completes platform-owned native fields through the config entry', { timeout: 180_000 }, () => {
    const nativeSource = [
      'import { defineConfig } from \'weapp-vite/config\'',
      'const common = { description: \'shared\' }',
      'defineConfig({ weapp: { multiPlatform: { projectConfigs: { /*platforms*/ } } } })',
      'export default defineConfig(({ mode }) => ({',
      '  weapp: { srcRoot: mode, multiPlatform: { projectConfigs: {',
      '    weapp: { ...common, /*weapp*/ },',
      '    alipay: { ...common, /*alipay*/ },',
      '    tt: { ...common, /*tt*/ },',
      '    xhs: { ...common, /*xhs*/ },',
      '    jd: { ...common, /*jd*/ },',
      '    swan: { ...common, /*swan*/ },',
      '  } } },',
      '}))',
      'defineConfig({ weapp: { multiPlatform: { projectConfigs: {',
      '  weapp: { setting: { /*weapp-setting*/ }, packOptions: { /*weapp-pack*/ } },',
      '  alipay: { compileOptions: { /*alipay-compile*/ }, developOptions: { /*alipay-develop*/ } },',
      '  tt: { setting: { /*tt-setting*/ } },',
      '  xhs: { setting: { /*xhs-setting*/ } },',
      '  swan: { setting: { /*swan-setting*/ }, \'compilation-args\': { common: { /*swan-compile*/ } } },',
      '} } } })',
    ].join('\n')
    const languageService = createLanguageService({ fileName, source: nativeSource, root })
    const completions = (marker: string) => {
      const position = nativeSource.indexOf(`/*${marker}*/`)
      expect(position).toBeGreaterThanOrEqual(0)
      // 含连字符的原生字段会以带引号的补全文本返回。
      return languageService.getCompletionsAtPosition(fileName, position, {})?.entries.map(entry => entry.name.replace(/^(["'])(.*)\1$/, '$2')) ?? []
    }

    try {
      expect(completions('platforms').sort()).toEqual(['alipay', 'jd', 'swan', 'tt', 'weapp', 'xhs'])
      const expectedFields = {
        'weapp': ['appid', 'projectname', 'libVersion', 'setting', 'packOptions'],
        'alipay': ['appid', 'format', 'compileOptions', 'developOptions', 'uploadExclude'],
        'tt': ['appid', 'projectname', 'disablePrivate', 'setting'],
        'xhs': ['appid', 'projectname', 'libVersion', 'setting'],
        'jd': ['appid', 'appId'],
        'swan': ['appid', 'developType', 'compilation-args'],
        'weapp-setting': ['es6', 'urlCheck', 'packNpmManually', 'babelSetting'],
        'weapp-pack': ['ignore', 'include'],
        'alipay-compile': ['typescript', 'component2', 'resolveAlias', 'transpile'],
        'alipay-develop': ['hotReload', 'sourcemap', 'minify'],
        'tt-setting': ['compileHotReLoad', 'autoCompile', 'useCompilerPlugins'],
        'xhs-setting': ['minified', 'urlCheck'],
        'swan-setting': ['urlCheck'],
        'swan-compile': ['ignoreTransJs', 'ignorePrefixCss'],
      }
      for (const [marker, fields] of Object.entries(expectedFields)) {
        expect(completions(marker), marker).toEqual(expect.arrayContaining(fields))
      }
      expect(completions('weapp')).not.toContain('compileOptions')
      expect(completions('alipay')).not.toContain('setting')
      expect(completions('swan-setting')).not.toContain('es6')
      expect(completions('jd')).not.toContain('setting')
      expect(languageService.getSemanticDiagnostics(fileName)).toEqual([])
    }
    finally {
      languageService.dispose()
    }
  })
})
