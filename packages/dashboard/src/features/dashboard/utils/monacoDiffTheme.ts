import type * as MonacoApi from 'monaco-editor'
import type { ResolvedTheme } from '../types'

type Monaco = typeof MonacoApi

const disabledTypeScriptDiagnostics = {
  noSemanticValidation: true,
  noSuggestionDiagnostics: true,
  noSyntaxValidation: true,
}
const disabledTypeScriptModeConfiguration = { diagnostics: false }

export function configureMonacoDiffEditor(monaco: Monaco) {
  monaco.typescript.javascriptDefaults.setDiagnosticsOptions(disabledTypeScriptDiagnostics)
  monaco.typescript.javascriptDefaults.setModeConfiguration(disabledTypeScriptModeConfiguration)
  monaco.typescript.typescriptDefaults.setDiagnosticsOptions(disabledTypeScriptDiagnostics)
  monaco.typescript.typescriptDefaults.setModeConfiguration(disabledTypeScriptModeConfiguration)

  monaco.editor.defineTheme('weapp-dashboard-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'diffEditor.insertedTextBackground': '#d1fae55f',
      'diffEditor.insertedLineBackground': '#ecfdf545',
      'diffEditor.removedTextBackground': '#ffe4e65c',
      'diffEditor.removedLineBackground': '#fff1f242',
      'diffEditor.diagonalFill': '#94a3b855',
      'editorGutter.modifiedBackground': '#2dd4bf',
      'editorGutter.addedBackground': '#10b981',
      'editorGutter.deletedBackground': '#f43f5e',
    },
  })
  monaco.editor.defineTheme('weapp-dashboard-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'diffEditor.insertedTextBackground': '#14532d2c',
      'diffEditor.insertedLineBackground': '#052e161c',
      'diffEditor.removedTextBackground': '#5f1f2a24',
      'diffEditor.removedLineBackground': '#2a111818',
      'diffEditor.diagonalFill': '#33415588',
      'editorGutter.modifiedBackground': '#2dd4bf',
      'editorGutter.addedBackground': '#22c55e',
      'editorGutter.deletedBackground': '#fb7185',
    },
  })
}

export function resolveMonacoTheme(theme: ResolvedTheme) {
  return theme === 'dark' ? 'weapp-dashboard-dark' : 'weapp-dashboard-light'
}
