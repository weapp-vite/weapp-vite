import type { DocumentInput, LanguageOptions } from '@weapp-vite/language-service'
import type { ProjectDocument, ProjectLanguageConfig } from '@weapp-vite/language-service/project'
import { analyzeProject, loadProjectConfig, resolveProjectDocumentInput } from '@weapp-vite/language-service/project'
import { expectAssignable, expectType } from 'tsd'

expectType<Promise<ProjectLanguageConfig>>(loadProjectConfig('.'))
expectType<Promise<ProjectDocument[]>>(analyzeProject('.', ['src/**/*.sjs'], { overrides: [{ files: ['**/*.sjs'], platform: 'tt' }] }))
expectType<Promise<DocumentInput>>(resolveProjectDocumentInput({ root: '.', language: {} }, 'src/tools.sjs', 'module.exports = {}'))
expectAssignable<LanguageOptions>({ platform: 'swan' })
