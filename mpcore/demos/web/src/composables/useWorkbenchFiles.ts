import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import { buildTreeNodes } from '../lib/workbench'

export function useWorkbenchFiles(
  fileEntries: Ref<Array<{ content: string, path: string }>>,
  currentRoute: Ref<string>,
) {
  const selectedFilePath = ref('')
  const openFileTabs = ref<string[]>([])
  const expandedTreePaths = ref<string[]>([])

  const fileMap = computed(() => new Map(fileEntries.value.map(entry => [entry.path, entry.content])))
  const routeSourceCandidates = computed(() => {
    const route = currentRoute.value === '未加载页面' ? '' : currentRoute.value
    return route
      ? [`${route}.js`, `${route}.wxml`, `${route}.json`, `${route}.wxss`]
      : []
  })

  const selectedFileContent = computed(() => fileMap.value.get(selectedFilePath.value) ?? '')
  const selectedFileLanguage = computed(() => {
    const extension = selectedFilePath.value.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'js':
      case 'ts':
        return 'javascript'
      case 'json':
        return 'json'
      case 'wxml':
      case 'html':
        return 'html'
      case 'wxss':
      case 'css':
        return 'css'
      case 'xml':
        return 'xml'
      default:
        return 'javascript'
    }
  })

  const fileTree = computed(() => buildTreeNodes(fileEntries.value.map(entry => entry.path)))

  function resetFiles() {
    selectedFilePath.value = ''
    openFileTabs.value = []
    expandedTreePaths.value = []
  }

  function openFile(path: string) {
    if (!fileMap.value.has(path)) {
      return
    }
    const segments = path.split('/')
    const nextExpandedTreePaths = [
      ...new Set([
        ...expandedTreePaths.value,
        ...segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/')),
      ]),
    ]
    const nextOpenTabs = [...new Set([...openFileTabs.value, path])].slice(-6)

    if (
      selectedFilePath.value === path
      && nextOpenTabs.length === openFileTabs.value.length
      && nextOpenTabs.every((item, index) => item === openFileTabs.value[index])
      && nextExpandedTreePaths.length === expandedTreePaths.value.length
      && nextExpandedTreePaths.every((item, index) => item === expandedTreePaths.value[index])
    ) {
      return
    }

    selectedFilePath.value = path
    openFileTabs.value = nextOpenTabs
    expandedTreePaths.value = nextExpandedTreePaths
  }

  function toggleTreePath(path: string) {
    expandedTreePaths.value = expandedTreePaths.value.includes(path)
      ? expandedTreePaths.value.filter(item => item !== path)
      : [...expandedTreePaths.value, path]
  }

  watch(fileEntries, (entries) => {
    if (entries.length === 0) {
      selectedFilePath.value = ''
      resetFiles()
      return
    }

    if (expandedTreePaths.value.length === 0) {
      const roots = entries
        .map(entry => entry.path.split('/')[0])
        .filter((value, index, array) => array.indexOf(value) === index)
      expandedTreePaths.value = roots
    }

    const candidate = routeSourceCandidates.value.find(path => fileMap.value.has(path))
      ?? ['app.json', 'app.js', entries[0]?.path].find(path => path && fileMap.value.has(path))

    if (!selectedFilePath.value || !fileMap.value.has(selectedFilePath.value)) {
      openFile(candidate ?? entries[0].path)
      return
    }

    if (candidate && !openFileTabs.value.includes(candidate)) {
      openFileTabs.value = [...new Set([candidate, ...openFileTabs.value])].slice(0, 6)
    }
  }, { immediate: true })

  watch(currentRoute, () => {
    const candidate = routeSourceCandidates.value.find(path => fileMap.value.has(path))
    if (candidate) {
      openFile(candidate)
    }
  })

  return {
    expandedTreePaths,
    fileMap,
    fileTree,
    openFile,
    openFileTabs,
    resetFiles,
    routeSourceCandidates,
    selectedFileContent,
    selectedFileLanguage,
    selectedFilePath,
    toggleTreePath,
  }
}
