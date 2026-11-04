import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
export const defaultCorpusDirectory = path.join(repositoryRoot, 'packages/wxml/test/corpus')
export const defaultCorpusCache = path.join(repositoryRoot, '.tmp/template-corpus/cache')
export const defaultCorpusReports = path.join(repositoryRoot, '.tmp/template-corpus/reports')
