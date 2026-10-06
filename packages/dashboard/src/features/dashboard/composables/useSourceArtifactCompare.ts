import type { Ref } from 'vue'
import type { ResolvedTheme } from '../types'
import type { DashboardFileContent } from '../utils/sourceArtifactFiles'
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useObjectContentEditor } from '../components/objectInspection/useObjectContentEditor'
import { dashboardAnalyzeRevision, dashboardConnectionStatus } from '../utils/dashboardDevframe'
import { fetchDashboardFileContent } from '../utils/sourceArtifactFiles'

export interface SourceArtifactTarget {
  key: string
  file: string
}

/** 受控内容读取：请求不回写目标，修订、连接、目标或卸载改变都会作废旧结果。 */
export function useSourceArtifactCompare(options: {
  artifact: Ref<SourceArtifactTarget | null>
  sourcePath: Ref<string | null>
  theme: Ref<ResolvedTheme>
}) {
  const sourceContent = shallowRef<DashboardFileContent | null>(null)
  const artifactContent = shallowRef<DashboardFileContent | null>(null)
  const loadError = shallowRef('')
  const loading = shallowRef(false)
  const { editorElement, clearEditor, showContents } = useObjectContentEditor(options.theme)
  let requestId = 0
  let disposed = false
  const statusText = computed(() => loading.value
    ? '正在读取当前修订的内容…'
    : sourceContent.value && artifactContent.value
      ? '当前源码 ↔ 报告捕获的构建产物'
      : artifactContent.value ? '报告捕获的构建产物' : sourceContent.value ? '当前源码' : '尚无可读内容')

  async function loadComparison() {
    if (disposed) {
      return
    }
    const currentRequest = ++requestId
    const revision = dashboardAnalyzeRevision.value
    const sourcePath = options.sourcePath.value
    const artifact = options.artifact.value
    sourceContent.value = null
    artifactContent.value = null
    loadError.value = ''
    loading.value = false
    clearEditor()
    if (dashboardConnectionStatus.value !== 'connected') {
      loadError.value = '后端未连接。浏览上下文已保留，连接恢复后重新读取。'
      return
    }
    if (revision === null) {
      loadError.value = '报告正在更新或已失效，等待当前修订完成同步。'
      return
    }
    if (!artifact && !sourcePath) {
      return
    }
    const isCurrent = () => !disposed && requestId === currentRequest
      && dashboardAnalyzeRevision.value === revision
      && dashboardConnectionStatus.value === 'connected'
      && options.artifact.value?.key === artifact?.key
      && options.sourcePath.value === sourcePath
    loading.value = true
    try {
      const [source, output] = await Promise.allSettled([
        sourcePath ? fetchDashboardFileContent('source', sourcePath, revision) : Promise.resolve(null),
        artifact ? fetchDashboardFileContent('artifact', artifact.file, revision) : Promise.resolve(null),
      ])
      if (!isCurrent()) {
        return
      }
      const errors: string[] = []
      if (source.status === 'fulfilled') {
        sourceContent.value = source.value
      }
      else {
        errors.push(`源码：${source.reason instanceof Error ? source.reason.message : '读取失败'}`)
      }
      if (output.status === 'fulfilled') {
        artifactContent.value = output.value
      }
      else {
        errors.push(`产物：${output.reason instanceof Error ? output.reason.message : '读取失败'}`)
      }
      loadError.value = errors.join('；')
      await nextTick()
      if (isCurrent()) {
        await showContents(sourceContent.value, artifactContent.value, isCurrent)
      }
    }
    catch (error) {
      if (isCurrent()) {
        loadError.value = error instanceof Error ? error.message : '内容显示失败'
      }
    }
    finally {
      if (isCurrent()) {
        loading.value = false
      }
    }
  }

  watch(
    [() => options.artifact.value?.key, options.sourcePath, dashboardAnalyzeRevision, dashboardConnectionStatus],
    () => {
      void loadComparison()
    },
    { immediate: true, flush: 'sync' },
  )
  onBeforeUnmount(() => {
    disposed = true
    requestId += 1
    clearEditor()
  })
  return { artifactContent, sourceContent, editorElement, loadComparison, loadError, loading, statusText }
}
