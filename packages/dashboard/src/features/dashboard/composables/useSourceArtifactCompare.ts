import type * as MonacoApi from 'monaco-editor'
import type { Ref } from 'vue'
import type { LargestFileEntry } from '../types'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { configureMonacoDiffEditor, resolveMonacoTheme } from '../utils/monacoDiffTheme'

type Monaco = typeof MonacoApi
type MonacoDiffEditor = ReturnType<Monaco['editor']['createDiffEditor']>
type MonacoTextModel = ReturnType<Monaco['editor']['createModel']>
type DashboardFileKind = 'source' | 'artifact'
type MonacoWorkerConstructor = new () => Worker

interface DashboardFileContent {
  content: string
  language: string
  path: string
  size: number
}

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

function createFileKey(file: LargestFileEntry) {
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

async function fetchFileContent(kind: DashboardFileKind, filePath: string) {
  const query = new URLSearchParams({ kind, path: filePath })
  const response = await fetch(`/__weapp_vite_file_content?${query.toString()}`)
  const payload = await response.json() as DashboardFileContent & { message?: string }
  if (!response.ok) {
    throw new Error(payload.message || '文件读取失败')
  }
  return {
    ...payload,
    language: normalizeLanguage(payload.language, payload.path),
  }
}

export function useSourceArtifactCompare(options: {
  activeFileKey: Ref<string | null>
  files: Ref<LargestFileEntry[]>
  theme: Ref<'light' | 'dark'>
  onSelectFile: (file: LargestFileEntry) => void
}) {
  const editorElement = ref<HTMLDivElement>()
  const selectedArtifactKey = ref('')
  const selectedSourcePath = ref('')
  const sourceContent = shallowRef<DashboardFileContent | null>(null)
  const artifactContent = shallowRef<DashboardFileContent | null>(null)
  const loadError = ref('')
  const loading = ref(false)
  const monacoRef = shallowRef<Monaco | null>(null)
  let diffEditor: MonacoDiffEditor | undefined
  let sourceModel: MonacoTextModel | undefined
  let artifactModel: MonacoTextModel | undefined
  let loadRequestId = 0

  const artifactOptions = computed(() => options.files.value.map(file => ({
    key: createFileKey(file),
    label: `${file.packageLabel} · ${file.file}`,
    file,
  })))

  const selectedArtifact = computed(() =>
    artifactOptions.value.find(item => item.key === selectedArtifactKey.value)?.file
    ?? options.files.value[0]
    ?? null)

  const sourceOptions = computed(() => {
    const paths = new Set<string>()
    const file = selectedArtifact.value
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
  })

  const statusText = computed(() => {
    if (loading.value) {
      return '加载中'
    }
    if (loadError.value) {
      return loadError.value
    }
    if (sourceContent.value && artifactContent.value) {
      return `${sourceContent.value.path} ↔ ${artifactContent.value.path}`
    }
    return '等待文件'
  })

  function resolveSelectedArtifactKey() {
    if (options.activeFileKey.value && artifactOptions.value.some(item => item.key === options.activeFileKey.value)) {
      return options.activeFileKey.value
    }
    return artifactOptions.value[0]?.key ?? ''
  }

  function disposeModels() {
    diffEditor?.setModel(null)
    sourceModel?.dispose()
    artifactModel?.dispose()
    sourceModel = undefined
    artifactModel = undefined
  }

  function updateEditorModel() {
    const monaco = monacoRef.value
    if (!monaco || !diffEditor || !sourceContent.value || !artifactContent.value) {
      return
    }
    disposeModels()
    sourceModel = monaco.editor.createModel(
      sourceContent.value.content,
      sourceContent.value.language,
      monaco.Uri.parse(`weapp-source://model/${encodeURIComponent(sourceContent.value.path)}`),
    )
    artifactModel = monaco.editor.createModel(
      artifactContent.value.content,
      artifactContent.value.language,
      monaco.Uri.parse(`weapp-artifact://model/${encodeURIComponent(artifactContent.value.path)}`),
    )
    diffEditor.setModel({
      original: sourceModel,
      modified: artifactModel,
    })
  }

  async function ensureEditor() {
    if (monacoRef.value || !editorElement.value) {
      return
    }
    const monaco = await import('monaco-editor')
    monacoRef.value = monaco
    configureMonacoDiffEditor(monaco)
    monaco.editor.setTheme(resolveMonacoTheme(options.theme.value))
    diffEditor = monaco.editor.createDiffEditor(editorElement.value, {
      automaticLayout: true,
      minimap: { enabled: false },
      originalEditable: false,
      readOnly: true,
      renderSideBySide: true,
      scrollBeyondLastLine: false,
    })
  }

  async function loadComparison() {
    const requestId = ++loadRequestId
    const sourcePath = selectedSourcePath.value
    const artifact = selectedArtifact.value
    if (!sourcePath || !artifact) {
      sourceContent.value = null
      artifactContent.value = null
      loadError.value = sourceOptions.value.length === 0 ? '无源码候选' : ''
      disposeModels()
      return
    }

    loading.value = true
    loadError.value = ''
    options.onSelectFile(artifact)
    try {
      const [source, output] = await Promise.all([
        fetchFileContent('source', sourcePath),
        fetchFileContent('artifact', artifact.file),
      ])
      if (requestId !== loadRequestId) {
        return
      }
      sourceContent.value = source
      artifactContent.value = output
      await nextTick()
      await ensureEditor()
      updateEditorModel()
    }
    catch (error) {
      if (requestId !== loadRequestId) {
        return
      }
      sourceContent.value = null
      artifactContent.value = null
      disposeModels()
      loadError.value = error instanceof Error ? error.message : '文件读取失败'
    }
    finally {
      if (requestId === loadRequestId) {
        loading.value = false
      }
    }
  }

  watch(
    () => [options.activeFileKey.value, artifactOptions.value.map(item => item.key).join('\u0000')],
    () => {
      selectedArtifactKey.value = resolveSelectedArtifactKey()
    },
    { immediate: true },
  )

  watch(
    sourceOptions,
    (items) => {
      selectedSourcePath.value = items[0] ?? ''
    },
    { immediate: true },
  )

  watch(
    [selectedArtifactKey, selectedSourcePath],
    () => {
      void loadComparison()
    },
    { immediate: true },
  )

  watch(
    options.theme,
    (theme) => {
      monacoRef.value?.editor.setTheme(resolveMonacoTheme(theme))
    },
  )

  onBeforeUnmount(() => {
    disposeModels()
    diffEditor?.dispose()
  })

  return {
    artifactContent,
    artifactOptions,
    editorElement,
    loadComparison,
    loadError,
    loading,
    selectedArtifactKey,
    selectedSourcePath,
    sourceContent,
    sourceOptions,
    statusText,
  }
}
