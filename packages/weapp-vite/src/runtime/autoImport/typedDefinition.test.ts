import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { extractInlinePropsTypeFromCode } from './dtsProps'
import { createTypedComponentsDefinition } from './typedDefinition'

function normalizeFileKey(filePath: string) {
  const normalized = filePath.replaceAll('\\', '/')
  return ts.sys.useCaseSensitiveFileNames ? normalized : normalized.toLowerCase()
}

function createLanguageService(files: Map<string, string>, options: ts.CompilerOptions) {
  const fileNames = [...files.keys()]
  const snapshots = new Map(
    fileNames.map(fileName => [normalizeFileKey(fileName), files.get(fileName)!]),
  )
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => options,
    getCurrentDirectory: () => process.cwd(),
    getDefaultLibFileName: targetOptions => ts.getDefaultLibFilePath(targetOptions),
    getDirectories: ts.sys.getDirectories,
    getScriptFileNames: () => fileNames,
    getScriptSnapshot: (targetFileName) => {
      const content = snapshots.get(normalizeFileKey(targetFileName)) ?? ts.sys.readFile(targetFileName)
      return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content)
    },
    getScriptVersion: () => '1',
    readDirectory: ts.sys.readDirectory,
    readFile: targetFileName => snapshots.get(normalizeFileKey(targetFileName)) ?? ts.sys.readFile(targetFileName),
    fileExists: targetFileName => snapshots.has(normalizeFileKey(targetFileName)) || ts.sys.fileExists(targetFileName),
    directoryExists: ts.sys.directoryExists,
  }
  return ts.createLanguageService(host)
}

describe('createTypedComponentsDefinition', () => {
  it('emits semantically resolvable local and imported prop types', () => {
    const props = extractInlinePropsTypeFromCode(`
import type { ImportedFilter as RemoteFilter } from '@fixtures/filter-types'
import type { RelativeFilter } from './relative-filter'

defineProps<{
  filters?: FilterItem[]
  remote?: RemoteFilter
  relative?: RelativeFilter
  raw?: MissingLocal
}>()

interface FilterItem {
  value: string
  label: string
  count?: number
}
    `.trim())
    const definition = createTypedComponentsDefinition(
      ['filter-bar'],
      () => ({ types: props, docs: new Map() }),
    )

    expect(definition).not.toContain('FilterItem')
    expect(definition).not.toContain('RelativeFilter')
    expect(definition).not.toContain('MissingLocal')
    expect(definition).not.toContain('./relative-filter')
    expect(definition).toContain('import("@fixtures/filter-types").ImportedFilter')
    expect(definition).not.toMatch(/\bany\b/)
    expect(definition).not.toContain('@ts-nocheck')
    expect(definition).not.toContain('[name: string]')

    const projectRoot = path.resolve(__dirname, '../../..')
    const definitionFile = path.join(projectRoot, 'test/__virtual__/typed-components-portable.d.ts')
    const importedTypesFile = path.join(projectRoot, 'test/__virtual__/filter-types.d.ts')
    const consumerFile = path.join(projectRoot, 'test/__virtual__/typed-components-consumer.ts')
    const files = new Map<string, string>([
      [definitionFile, definition],
      [
        importedTypesFile,
        [
          'declare module \'@fixtures/filter-types\' {',
          '  export interface ImportedFilter {',
          '    label: string',
          '  }',
          '}',
        ].join('\n'),
      ],
      [
        consumerFile,
        [
          'import type { ComponentProp } from \'weapp-vite/typed-components\'',
          'declare const props: ComponentProp<\'filter-bar\'>',
          'const localValue: string = props.filters![0]!.value',
          'const importedLabel: string = props.remote!.label',
          'const relativeValue: unknown = props.relative',
          'const rawValue: unknown = props.raw',
          'void localValue',
          'void importedLabel',
          'void relativeValue',
          'void rawValue',
        ].join('\n'),
      ],
    ])
    const languageService = createLanguageService(files, {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      skipLibCheck: false,
      noEmit: true,
    })
    const diagnostics = [
      ...languageService.getSemanticDiagnostics(definitionFile),
      ...languageService.getSemanticDiagnostics(importedTypesFile),
      ...languageService.getSemanticDiagnostics(consumerFile),
    ]

    expect(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([])
  })
})
