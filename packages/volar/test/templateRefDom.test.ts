import path from 'node:path'
import ts from 'typescript'

function compileDomConsumer(source: string) {
  const fileName = path.resolve('template-ref-dom-consumer.ts').replaceAll('\\', '/')
  const options: ts.CompilerOptions = {
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: false,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    types: [],
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => name.replaceAll('\\', '/') === fileName
    ? ts.createSourceFile(name, source, languageVersion)
    : getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile)
  return ts.getPreEmitDiagnostics(ts.createProgram([fileName], options, host))
    .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
}

describe('strict DOM map compiler control', () => {
  it('accepts the unmodified browser tag map without SDK or workspace declarations', () => {
    const diagnostics = compileDomConsumer(`export {}
const map: HTMLMapElement = document.createElement('map')
const element: Element = map
void element`)
    expect(diagnostics).toEqual([])
  })

  it('detects a non-Element tag inserted into lib.dom even when the consumer never selects that tag', () => {
    const diagnostics = compileDomConsumer(`export {}
declare global {
  interface HTMLElementTagNameMap {
    'native-ref-negative-control': { selector: string }
  }
}
const map: HTMLMapElement = document.createElement('map')
void map`)
    expect(diagnostics.some(diagnostic => diagnostic.code === 2344
      && diagnostic.file?.fileName.endsWith('lib.dom.d.ts')
      && ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n').includes('HTMLElementTagNameMap'))).toBe(true)
  })
})
