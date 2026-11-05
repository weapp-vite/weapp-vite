import type { DocumentContext } from '../../documentContext'
import type { EditVisitors, TemplateDocument } from '../../types'
import type { PathSession } from './model'
import { assertValid } from '../state'
import { createList } from './model'
import { LiveEditPath } from './path'
import { commit } from './render'
import { traverse } from './traverse'

/** 路径式会话拥有独立当前树，退出 visitor 后统一提交源码与公开坐标。 */
export function editPaths<State>(document: TemplateDocument, visitors: EditVisitors<State>, state: State, context: DocumentContext): TemplateDocument {
  assertValid(document)
  const session: PathSession = {
    document,
    context,
    roots: createList(document.source, document.children, true),
    active: true,
    version: 0,
    traversals: [],
    makePath(record) {
      return record.path ??= new LiveEditPath(session, record)
    },
  }
  try {
    traverse(session, session.roots, visitors, state)
    session.active = false
    return commit(session)
  }
  finally {
    session.active = false
    session.traversals.length = 0
  }
}
