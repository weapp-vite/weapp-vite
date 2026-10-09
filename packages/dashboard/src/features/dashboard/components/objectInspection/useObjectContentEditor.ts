import type * as MonacoApi from 'monaco-editor'
import type { Ref } from 'vue'
import type { ResolvedTheme } from '../../types'
import type { DashboardFileContent } from '../../utils/sourceArtifactFiles'
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { configureMonacoDiffEditor, resolveMonacoTheme } from '../../utils/monacoDiffTheme'

type Monaco = typeof MonacoApi

/** 编辑器仅消费已确认的内容；不选择对象，也不读取文件。 */
export function useObjectContentEditor(theme: Ref<ResolvedTheme>) {
  const editorElement = shallowRef<HTMLDivElement>()
  let monaco: Monaco | undefined
  let editor: MonacoApi.editor.IStandaloneCodeEditor | MonacoApi.editor.IStandaloneDiffEditor | undefined
  let models: MonacoApi.editor.ITextModel[] = []
  let disposed = false

  function clearEditor() {
    editor?.dispose()
    editor = undefined
    for (const model of models) {
      model.dispose()
    }
    models = []
  }

  async function showContents(source: DashboardFileContent | null, artifact: DashboardFileContent | null, isCurrent: () => boolean) {
    const host = editorElement.value
    if (!host || !isCurrent() || disposed || (!source && !artifact)) {
      return
    }
    // Monaco 依赖浏览器 DOM；保留原阅读器的延迟加载边界，避免无编辑器的环境执行它。
    const api = monaco ?? await import('monaco-editor')
    if (!isCurrent() || disposed || editorElement.value !== host) {
      return
    }
    monaco = api
    configureMonacoDiffEditor(api)
    api.editor.setTheme(resolveMonacoTheme(theme.value))
    clearEditor()
    const options = {
      automaticLayout: true,
      minimap: { enabled: false },
      readOnly: true,
      domReadOnly: true,
      scrollBeyondLastLine: false,
      wordWrap: 'on' as const,
    }
    if (source && artifact) {
      const original = api.editor.createModel(source.content, source.language)
      const modified = api.editor.createModel(artifact.content, artifact.language)
      models = [original, modified]
      const diff = api.editor.createDiffEditor(host, {
        ...options,
        originalEditable: false,
        renderSideBySide: true,
        useInlineViewWhenSpaceIsLimited: true,
        renderSideBySideInlineBreakpoint: 650,
      })
      diff.setModel({ original, modified })
      editor = diff
    }
    else {
      const content = source ?? artifact!
      const model = api.editor.createModel(content.content, content.language)
      models = [model]
      editor = api.editor.create(host, { ...options, model, ariaLabel: source ? '当前源码，只读' : '报告产物，只读' })
    }
  }

  watch(theme, value => monaco?.editor.setTheme(resolveMonacoTheme(value)))
  onBeforeUnmount(() => {
    disposed = true
    clearEditor()
  })
  return { editorElement, clearEditor, showContents }
}
