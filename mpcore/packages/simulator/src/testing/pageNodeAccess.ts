import type { HeadlessProjectDescriptor } from '../project'
import type { HeadlessPageInstance, HeadlessSession } from '../runtime'
import { HeadlessTestingNodeHandle, renderPageTree } from '../view'
import { HeadlessTestingScopeHandle } from './sessionHandle'

export interface HeadlessTestingPageNodeAccessOptions {
  assertActive: () => void
  createPageHandle: () => { data: (path?: string) => Promise<unknown> }
  page: HeadlessPageInstance
  project: HeadlessProjectDescriptor
  session?: HeadlessSession
}

export function createPageRootNodeHandle(options: HeadlessTestingPageNodeAccessOptions) {
  const { page, project, session } = options
  const tree = session?.getCurrentPages().includes(page)
    ? session.renderCurrentPage()
    : renderPageTree(project, page)
  const rootNode = tree.root.type === 'root'
    ? (tree.root.children?.[0] ?? tree.root)
    : tree.root

  return new HeadlessTestingNodeHandle(rootNode, {
    assertActive: options.assertActive,
    callMethod: (scopeId, methodName, event) => {
      if (session?.getCurrentPages().includes(page)) {
        return session.callScopeMethod(scopeId, methodName, event)
      }
      const method = page[methodName]
      if (typeof method !== 'function') {
        throw new TypeError(`Method "${methodName}" does not exist on headless page ${page.route}.`)
      }
      return method.call(page, event)
    },
    createPageHandle: options.createPageHandle,
    createScopeHandle: (scopeId) => {
      if (!session) {
        throw new Error('Scope handles are not available without an active headless testing session.')
      }
      return scopeId ? new HeadlessTestingScopeHandle(scopeId, project, session) : null
    },
    ownerScopeId: (scopeId) => {
      if (!session || !scopeId) {
        return null
      }
      const scopeSnapshot = session.getScopeSnapshot(scopeId) as { type?: string } | null
      if (scopeSnapshot?.type !== 'component') {
        return null
      }
      const owner = session.selectOwnerComponent(scopeId)
      return session.getScopeIdForComponent(owner)
    },
  })
}
