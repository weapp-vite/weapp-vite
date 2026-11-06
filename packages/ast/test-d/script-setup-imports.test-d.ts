import type { ScriptSetupImport, ScriptSetupImportAnalysis } from '@weapp-vite/ast'
import { analyzeScriptSetupImportsFromCode, collectScriptSetupImportsFromCode } from '@weapp-vite/ast'
import { analyzeScriptSetupImportsFromCode as analyzeOperation } from '@weapp-vite/ast/operations/scriptSetupImports'
import { expectError, expectType } from 'tsd'

const names = new Set(['Card'])
const source = 'import Card from "./Card.vue"'
const result = analyzeScriptSetupImportsFromCode(source, names, { astEngine: 'oxc' })
expectType<ScriptSetupImportAnalysis>(result)
expectType<'complete' | 'failed'>(result.status)
expectType<ScriptSetupImport[]>(result.imports)
expectType<ScriptSetupImportAnalysis>(analyzeOperation(source, names))
expectType<ScriptSetupImport[]>(collectScriptSetupImportsFromCode(source, names))
expectError(analyzeScriptSetupImportsFromCode(source, ['Card']))
expectError(analyzeScriptSetupImportsFromCode(source, names, { astEngine: 'invalid' }))
