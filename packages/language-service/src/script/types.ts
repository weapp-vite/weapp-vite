import type { Diagnostic, DocumentInput, LanguagePlatform, SourceRange } from '../types'

export type ScriptSourceKind = 'native' | 'compiled'
export type ScriptDialect = 'wxs' | 'sjs' | 'ks' | 'javascript'
export type ScriptExportScope = 'named' | 'default-member' | 'commonjs' | 'default'

export interface ScriptOptions {
  platform?: LanguagePlatform
  sourceKind?: ScriptSourceKind
  dialect?: ScriptDialect
  language?: 'javascript' | 'typescript'
}

export interface ScriptInput extends DocumentInput {
  sourceKind?: ScriptSourceKind
  dialect?: ScriptDialect
  language?: 'javascript' | 'typescript'
}

export interface ScriptAnalysis {
  diagnostics: Diagnostic[]
  valid: boolean
  dialect: ScriptDialect
  sourceKind: ScriptSourceKind
  references: ScriptReference[]
  symbols: ScriptSymbol[]
  imports: ScriptImportBinding[]
  externalUses: ScriptExternalUse[]
}

export interface ScriptImportRename {
  kind: 'import-shorthand' | 'property-shorthand' | 'name'
  localName?: string
}

export interface ScriptImportBinding extends SourceRange {
  source: string
  imported: string
  localName: string
  kind: 'default' | 'named' | 'namespace' | 'require'
  targetScope: ScriptExportScope
  targetPath?: string[]
  importedRange?: SourceRange
  rename?: ScriptImportRename
}

export interface ScriptExternalUse extends SourceRange {
  source: string
  imported: string
  localName?: string
  declaration?: SourceRange
  kind: 'binding' | 'member' | 'reexport'
  targetScope: ScriptExportScope
  targetPath?: string[]
  rename?: ScriptImportRename
}

export interface ScriptReference extends SourceRange {
  source: string
  kind: 'import' | 'require' | 'export'
}

export interface ScriptSymbol extends SourceRange {
  name: string
  kind: 'declaration' | 'reference' | 'export'
  exportScope?: ScriptExportScope
  declaration?: SourceRange
  rename?: { kind: 'property-shorthand' | 'export-shorthand' | 'import-shorthand' | 'binding' | 'name', localName?: string }
}

export interface ScriptFormatResult {
  code: string
  diagnostics: Diagnostic[]
  changed: boolean
}

export interface ScriptFormatterResult {
  code: string
  errors?: ReadonlyArray<{ message: string }>
}

export interface ScriptFormatterOptions {
  trailingComma?: 'none'
  embeddedLanguageFormatting: 'off'
}

export interface FormatScriptOptions extends ScriptOptions {
  format: (fileName: string, source: string, options: ScriptFormatterOptions) => ScriptFormatterResult | Promise<ScriptFormatterResult>
}
