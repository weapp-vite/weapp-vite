import type { LargestFileEntry } from '../types'
import type { DashboardFileKind } from './dashboardDevframe'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import TypeScriptWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import { readDashboardFileContent } from './dashboardDevframe'

export type { DashboardFileContent } from './dashboardDevframe'

type MonacoWorkerConstructor = new () => Worker

const workerByLabel: Record<string, MonacoWorkerConstructor> = {
  css: CssWorker,
  html: HtmlWorker,
  javascript: TypeScriptWorker,
  json: JsonWorker,
  less: CssWorker,
  scss: CssWorker,
  typescript: TypeScriptWorker,
}
const globalWithMonaco = globalThis as unknown as {
  MonacoEnvironment?: { getWorker: (_workerId: string, label: string) => Worker }
}

globalWithMonaco.MonacoEnvironment = {
  getWorker: (_workerId, label) => {
    const WorkerConstructor = workerByLabel[label] ?? EditorWorker
    return new WorkerConstructor()
  },
}

export function createSourceArtifactFileKey(file: LargestFileEntry) {
  return `${file.packageId}:${file.file}`
}

function normalizeLanguage(language: string, filePath: string) {
  if (filePath.endsWith('.wxml') || filePath.endsWith('.vue')) {
    return 'html'
  }
  if (filePath.endsWith('.wxss')) {
    return 'css'
  }
  if (language === 'plaintext' && filePath.endsWith('.json')) {
    return 'json'
  }
  return language
}

function stripFileQuery(filePath: string) {
  const queryIndex = filePath.indexOf('?')
  return queryIndex === -1 ? filePath : filePath.slice(0, queryIndex)
}

export async function fetchDashboardFileContent(kind: DashboardFileKind, filePath: string) {
  const payload = await readDashboardFileContent(kind, filePath)
  return {
    ...payload,
    language: normalizeLanguage(payload.language, payload.path),
  }
}

export function createSourcePathOptions(file: LargestFileEntry | null) {
  const paths = new Set<string>()
  if (!file) {
    return []
  }
  if (file.source) {
    paths.add(stripFileQuery(file.source))
  }
  for (const module of file.modules ?? []) {
    if (module.sourceType === 'src' || module.sourceType === 'workspace' || module.sourceType === 'plugin') {
      paths.add(stripFileQuery(module.source))
    }
  }
  return [...paths].sort((a, b) => a.localeCompare(b))
}
