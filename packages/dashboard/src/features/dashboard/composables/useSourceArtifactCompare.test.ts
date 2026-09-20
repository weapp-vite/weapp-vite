import type { ShallowRef } from 'vue'
import type { LargestFileEntry } from '../types'
import type { DashboardFileContent } from '../utils/sourceArtifactFiles'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, defineComponent, nextTick, shallowRef, watch } from 'vue'
import { dashboardAnalyzeRevision } from '../utils/dashboardDevframe'
import { useSourceArtifactCompare } from './useSourceArtifactCompare'

type FetchDashboardFileContent = (
  kind: DashboardFileContent['kind'],
  filePath: string,
  revision: number,
) => Promise<DashboardFileContent>

const fetchDashboardFileContentMock = vi.hoisted(() => vi.fn<FetchDashboardFileContent>())

vi.mock('../utils/sourceArtifactFiles', () => ({
  createSourceArtifactFileKey: (file: LargestFileEntry) => `${file.packageId}:${file.file}`,
  createSourcePathOptions: (file: LargestFileEntry | null) => file?.source ? [file.source] : [],
  fetchDashboardFileContent: fetchDashboardFileContentMock,
}))

interface TestNode {
  children: TestNode[]
  parent: TestNode | null
  text: string
}

interface ComparisonState {
  artifactContent: ShallowRef<DashboardFileContent | null>
  sourceContent: ShallowRef<DashboardFileContent | null>
}

function createTestNode(text = ''): TestNode {
  return {
    children: [],
    parent: null,
    text,
  }
}

const renderer = createRenderer<TestNode, TestNode>({
  createComment: createTestNode,
  createElement: createTestNode,
  createText: createTestNode,
  insert(child, parent, anchor) {
    child.parent = parent
    const anchorIndex = anchor ? parent.children.indexOf(anchor) : -1
    if (anchorIndex === -1) {
      parent.children.push(child)
      return
    }
    parent.children.splice(anchorIndex, 0, child)
  },
  nextSibling(node) {
    if (!node.parent) {
      return null
    }
    const index = node.parent.children.indexOf(node)
    return node.parent.children[index + 1] ?? null
  },
  parentNode: node => node.parent,
  patchProp: () => {},
  remove(node) {
    if (!node.parent) {
      return
    }
    const index = node.parent.children.indexOf(node)
    if (index !== -1) {
      node.parent.children.splice(index, 1)
    }
    node.parent = null
  },
  setElementText(node, text) {
    node.text = text
  },
  setText(node, text) {
    node.text = text
  },
})

function createFileContent(kind: 'artifact' | 'source', path: string, revision: number) {
  const content = `${kind} revision ${revision}`
  return {
    content,
    kind,
    language: kind === 'source' ? 'typescript' : 'javascript',
    path,
    size: content.length,
  }
}

function mountComparison() {
  const file: LargestFileEntry = {
    packageId: '__main__',
    packageLabel: '主包',
    packageType: 'main',
    file: 'common.js',
    size: 20,
    compressedSize: 20,
    compressedSizeSource: 'estimated',
    type: 'chunk',
    from: 'main',
    isEntry: false,
    moduleCount: 1,
    source: 'src/common.ts',
  }
  let comparison: ComparisonState | undefined
  const app = renderer.createApp(defineComponent({
    setup() {
      comparison = useSourceArtifactCompare({
        activeFileKey: shallowRef<string | null>(null),
        files: shallowRef<LargestFileEntry[]>([file]),
        theme: shallowRef<'light' | 'dark'>('light'),
        onSelectFile: () => {},
      })
      return () => null
    },
  }))
  app.mount(createTestNode())
  return {
    app,
    comparison: comparison!,
  }
}

async function flushAsyncComparison() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

afterEach(() => {
  dashboardAnalyzeRevision.value = null
  fetchDashboardFileContentMock.mockReset()
})

describe('source artifact comparison revision', () => {
  it('reloads unchanged paths and displays both panes from the new report revision', async () => {
    const nextSource = Promise.withResolvers<DashboardFileContent>()
    const nextArtifact = Promise.withResolvers<DashboardFileContent>()
    fetchDashboardFileContentMock.mockImplementation((kind, path, revision) => {
      if (revision === 2) {
        return kind === 'source' ? nextSource.promise : nextArtifact.promise
      }
      return Promise.resolve(createFileContent(kind, path, revision))
    })
    dashboardAnalyzeRevision.value = 1
    const { app, comparison } = mountComparison()

    await vi.waitFor(() => {
      expect(comparison.sourceContent.value?.content).toBe('source revision 1')
      expect(comparison.artifactContent.value?.content).toBe('artifact revision 1')
    })

    dashboardAnalyzeRevision.value = 2
    await vi.waitFor(() => {
      expect(comparison.sourceContent.value).toBeNull()
      expect(comparison.artifactContent.value).toBeNull()
    })

    nextSource.resolve(createFileContent('source', 'src/common.ts', 2))
    nextArtifact.resolve(createFileContent('artifact', 'common.js', 2))
    await vi.waitFor(() => {
      expect(comparison.sourceContent.value?.content).toBe('source revision 2')
      expect(comparison.artifactContent.value?.content).toBe('artifact revision 2')
    })

    app.unmount()
  })

  it('ignores a completed pair from an obsolete report revision', async () => {
    const oldSource = Promise.withResolvers<DashboardFileContent>()
    const oldArtifact = Promise.withResolvers<DashboardFileContent>()
    const currentSource = Promise.withResolvers<DashboardFileContent>()
    const currentArtifact = Promise.withResolvers<DashboardFileContent>()
    fetchDashboardFileContentMock.mockImplementation((kind, _path, revision) => {
      if (revision === 1) {
        return kind === 'source' ? oldSource.promise : oldArtifact.promise
      }
      return kind === 'source' ? currentSource.promise : currentArtifact.promise
    })
    dashboardAnalyzeRevision.value = 1
    const { app, comparison } = mountComparison()
    const committedSourceContents: string[] = []
    const stopContentWatch = watch(
      comparison.sourceContent,
      (content) => {
        if (content) {
          committedSourceContents.push(content.content)
        }
      },
      { flush: 'sync' },
    )
    await vi.waitFor(() => {
      expect(fetchDashboardFileContentMock).toHaveBeenCalledTimes(2)
    })

    oldSource.resolve(createFileContent('source', 'src/common.ts', 1))
    oldArtifact.resolve(createFileContent('artifact', 'common.js', 1))
    await Promise.resolve()
    dashboardAnalyzeRevision.value = 2
    await flushAsyncComparison()
    expect(committedSourceContents).not.toContain('source revision 1')
    expect(comparison.sourceContent.value).toBeNull()
    expect(comparison.artifactContent.value).toBeNull()

    currentSource.resolve(createFileContent('source', 'src/common.ts', 2))
    currentArtifact.resolve(createFileContent('artifact', 'common.js', 2))
    await vi.waitFor(() => {
      expect(comparison.sourceContent.value?.content).toBe('source revision 2')
      expect(comparison.artifactContent.value?.content).toBe('artifact revision 2')
    })

    stopContentWatch()
    app.unmount()
  })

  it('invalidates pending reads when the comparison is unmounted', async () => {
    const source = Promise.withResolvers<DashboardFileContent>()
    const artifact = Promise.withResolvers<DashboardFileContent>()
    fetchDashboardFileContentMock.mockImplementation(kind => (
      kind === 'source' ? source.promise : artifact.promise
    ))
    dashboardAnalyzeRevision.value = 3
    const { app, comparison } = mountComparison()
    await vi.waitFor(() => {
      expect(fetchDashboardFileContentMock).toHaveBeenCalledTimes(2)
    })

    app.unmount()
    source.resolve(createFileContent('source', 'src/common.ts', 3))
    artifact.resolve(createFileContent('artifact', 'common.js', 3))
    await flushAsyncComparison()

    expect(comparison.sourceContent.value).toBeNull()
    expect(comparison.artifactContent.value).toBeNull()
  })
})
