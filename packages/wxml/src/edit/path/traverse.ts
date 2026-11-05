import type { EditCallback, EditNode, EditNodeVisitor, EditVisitors } from '../../types'
import type { ChildList, PathRecord, PathSession, TraversalContext, TraversalFrame } from './model'
import { isAttached } from './model'

interface Frame extends TraversalFrame {
  phase: 'enter' | 'children' | 'exit'
  list: ChildList
  cursor: number
  version: number
  seen: Set<PathRecord>
  exited?: boolean
}

const visitorNames = { element: 'Element', text: 'Text', comment: 'Comment', cdata: 'Cdata', declaration: 'Declaration', script: 'Script' } as const

function validateVisitors(visitors: object) {
  const known = new Set(['enter', 'exit', ...Object.values(visitorNames)])
  for (const [name, visitor] of Object.entries(visitors)) {
    if (!known.has(name)) {
      throw new TypeError(`Unknown WXML edit visitor: ${name}.`)
    }
    if (visitor === undefined || typeof visitor === 'function') {
      continue
    }
    if (name === 'enter' || name === 'exit' || !visitor || typeof visitor !== 'object' || Array.isArray(visitor)) {
      throw new TypeError(`Expected a synchronous WXML edit visitor for ${name}.`)
    }
    for (const [phase, callback] of Object.entries(visitor)) {
      if ((phase !== 'enter' && phase !== 'exit') || (callback !== undefined && typeof callback !== 'function')) {
        throw new TypeError(`Expected enter/exit WXML edit callbacks for ${name}.`)
      }
    }
  }
}

function invoke<State>(callback: EditCallback<State> | undefined, record: PathRecord, session: PathSession, state: State) {
  const result: unknown = callback?.(session.makePath(record), state)
  if (result !== null && (typeof result === 'object' || typeof result === 'function') && typeof (result as { then?: unknown }).then === 'function') {
    void Promise.resolve(result).catch(() => {})
    throw new TypeError('WXML edit visitors must be synchronous; Promise results are not supported.')
  }
  return result === false
}

function callbacks<State>(visitors: EditVisitors<State>, record: PathRecord, phase: 'enter' | 'exit') {
  const typed = visitors[visitorNames[record.base.kind]] as EditNodeVisitor<State, EditNode> | undefined
  const callback = typeof typed === 'function' ? phase === 'enter' ? typed : undefined : typed?.[phase]
  return phase === 'enter' ? [visitors.enter, callback] : [callback, visitors.exit]
}

function makeFrame(list: ChildList, record?: PathRecord): Frame {
  return { record, phase: record ? 'enter' : 'children', list, cursor: 0, version: list.version, seen: new Set(), skipped: false }
}

/** 当前子列表决定后续访问；已访问兄弟保留身份，新插入或替换的路径会补入队列。 */
export function traverse<State>(session: PathSession, list: ChildList, visitors: EditVisitors<State>, state: State, owner?: PathRecord) {
  if (!visitors || typeof visitors !== 'object' || Array.isArray(visitors)) {
    throw new TypeError('Expected synchronous WXML edit visitors.')
  }
  validateVisitors(visitors)
  const context: TraversalContext = { stopped: false, frames: [], requeues: [], requeueCounts: new Map() }
  const stack: Frame[] = [makeFrame(list)]
  context.frames = stack
  session.traversals.push(context)
  try {
    while ((stack.length || context.requeues.length) && !context.stopped) {
      if (owner && !isAttached(owner)) {
        break
      }
      if (!stack.length) {
        const queued = context.requeues.shift()!
        if (isAttached(queued)) {
          stack.push(makeFrame(queued.children, queued))
        }
        continue
      }
      const frame = stack[stack.length - 1]!
      context.frame = frame
      const record = frame.record
      if (record && !isAttached(record)) {
        stack.pop()
        continue
      }
      if (frame.phase !== 'children') {
        const phase = frame.phase
        for (const callback of callbacks(visitors, record!, phase)) {
          if (context.stopped || !isAttached(record!)) {
            break
          }
          if (invoke(callback, record!, session, state)) {
            frame.skipped = true
          }
        }
        if (phase === 'exit') {
          // exit 只执行一次；它新增的后代仍由当前子列表补访问。
          frame.exited = true
          frame.phase = 'children'
        }
        else {
          frame.phase = 'children'
          frame.list = record!.children
          frame.version = frame.list.version
        }
        continue
      }
      if (frame.skipped) {
        if (frame.exited) {
          stack.pop()
        }
        else {
          frame.phase = 'exit'
        }
        continue
      }
      const container = record ?? owner
      if (container && frame.list !== container.children) {
        frame.list = container.children
        frame.version = -1
      }
      if (frame.version !== frame.list.version) {
        frame.version = frame.list.version
        frame.cursor = 0
      }
      let next: PathRecord | undefined
      while (frame.cursor < frame.list.items.length) {
        const item = frame.list.items[frame.cursor++]!
        if (isAttached(item) && !frame.seen.has(item)) {
          next = item
          break
        }
      }
      if (next) {
        frame.seen.add(next)
        stack.push(makeFrame(next.children, next))
      }
      else if (record) {
        if (frame.exited) {
          stack.pop()
        }
        else {
          frame.phase = 'exit'
        }
      }
      else {
        stack.pop()
      }
    }
  }
  finally {
    session.traversals.pop()
  }
}

export function traversalFor(session: PathSession) {
  // 公开控制方法先验证 active；active 期间始终至少存在当前遍历。
  return session.traversals[session.traversals.length - 1]!
}

/** 保护按单路径累计，不限制整棵树的大小；无源码进展的重复排队单独设限。 */
export function requeue(session: PathSession, record: PathRecord) {
  const traversal = traversalFor(session)
  const count = traversal.requeueCounts.get(record) ?? { total: 0, unchanged: 0, version: session.version }
  count.total++
  count.unchanged = count.version === session.version ? count.unchanged + 1 : 0
  count.version = session.version
  traversal.requeueCounts.set(record, count)
  if (count.total > 10000 || count.unchanged > 32) {
    throw new Error('WXML edit requeue limit exceeded for one path; repeated requeue must make progress and terminate.')
  }
  if (!traversal.requeues.includes(record)) {
    traversal.requeues.push(record)
  }
}
