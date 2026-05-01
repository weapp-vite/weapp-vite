import type * as MonacoApi from 'monaco-editor'
import type { Ref } from 'vue'
import type { LargestFileEntry } from '../types'
import type { DashboardFileContent } from '../utils/sourceArtifactFiles'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
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
        fetchDashboardFileContent('source', sourcePath),
        fetchDashboardFileContent('artifact', artifact.file),
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
