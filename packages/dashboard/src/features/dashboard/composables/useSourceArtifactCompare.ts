import type * as MonacoApi from 'monaco-editor'
import type { Ref } from 'vue'
import type { LargestFileEntry } from '../types'
import type { DashboardFileContent } from '../utils/sourceArtifactFiles'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { dashboardAnalyzeRevision } from '../utils/dashboardDevframe'
import { configureMonacoDiffEditor, resolveMonacoTheme } from '../utils/monacoDiffTheme'
import { createSourceArtifactFileKey, createSourcePathOptions, fetchDashboardFileContent } from '../utils/sourceArtifactFiles'
import { createSourceCompareStats } from '../utils/sourceCompareSummary'

type Monaco = typeof MonacoApi
type MonacoDiffEditor = ReturnType<Monaco['editor']['createDiffEditor']>
type MonacoTextModel = ReturnType<Monaco['editor']['createModel']>

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
  let disposed = false

  const artifactOptions = computed(() => options.files.value.map(file => ({
    key: createSourceArtifactFileKey(file),
    label: `${file.packageLabel} · ${file.file}`,
    file,
  })))

  const selectedArtifact = computed(() =>
    artifactOptions.value.find(item => item.key === selectedArtifactKey.value)?.file
    ?? options.files.value[0]
    ?? null)

  const sourceOptions = computed(() => createSourcePathOptions(selectedArtifact.value))

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
  const compareStats = computed(() => sourceContent.value && artifactContent.value
    ? createSourceCompareStats(sourceContent.value.content, artifactContent.value.content)
    : null)

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

  function isCurrentLoad(
    requestId: number,
    revision: number,
    sourcePath: string,
    artifactKey: string,
  ) {
    return !disposed
      && requestId === loadRequestId
      && dashboardAnalyzeRevision.value === revision
      && selectedSourcePath.value === sourcePath
      && selectedArtifactKey.value === artifactKey
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
    const editorHost = editorElement.value
    if (disposed || monacoRef.value || !editorHost) {
      return
    }
    // Monaco 体积较大，仅在编辑器容器就绪后按需加载。
    const monaco = await import('monaco-editor')
    if (disposed || editorElement.value !== editorHost || monacoRef.value) {
      return
    }
    monacoRef.value = monaco
    configureMonacoDiffEditor(monaco)
    monaco.editor.setTheme(resolveMonacoTheme(options.theme.value))
    diffEditor = monaco.editor.createDiffEditor(editorHost, {
      automaticLayout: true,
      minimap: { enabled: false },
      originalEditable: false,
      readOnly: true,
      renderSideBySide: true,
      scrollBeyondLastLine: false,
    })
  }

  async function loadComparison() {
    if (disposed) {
      return
    }
    const requestId = ++loadRequestId
    const sourcePath = selectedSourcePath.value
    const artifact = selectedArtifact.value
    const revision = dashboardAnalyzeRevision.value
    const artifactKey = selectedArtifactKey.value
    if (revision === null || !sourcePath || !artifact) {
      sourceContent.value = null
      artifactContent.value = null
      loadError.value = sourceOptions.value.length === 0 ? '无源码候选' : ''
      loading.value = false
      disposeModels()
      return
    }

    loading.value = true
    loadError.value = ''
    sourceContent.value = null
    artifactContent.value = null
    disposeModels()
    options.onSelectFile(artifact)
    try {
      const [source, output] = await Promise.all([
        fetchDashboardFileContent('source', sourcePath, revision),
        fetchDashboardFileContent('artifact', artifact.file, revision),
      ])
      if (!isCurrentLoad(requestId, revision, sourcePath, artifactKey)) {
        return
      }
      sourceContent.value = source
      artifactContent.value = output
      await nextTick()
      if (!isCurrentLoad(requestId, revision, sourcePath, artifactKey)) {
        return
      }
      await ensureEditor()
      if (!isCurrentLoad(requestId, revision, sourcePath, artifactKey)) {
        return
      }
      updateEditorModel()
    }
    catch (error) {
      if (!isCurrentLoad(requestId, revision, sourcePath, artifactKey)) {
        return
      }
      sourceContent.value = null
      artifactContent.value = null
      disposeModels()
      loadError.value = error instanceof Error ? error.message : '文件读取失败'
    }
    finally {
      if (isCurrentLoad(requestId, revision, sourcePath, artifactKey)) {
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
    [selectedArtifactKey, selectedSourcePath, dashboardAnalyzeRevision],
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
    disposed = true
    loadRequestId += 1
    disposeModels()
    diffEditor?.dispose()
  })

  return {
    artifactContent,
    artifactOptions,
    compareStats,
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
