import type { HeadlessComponentInstance } from './types'
import { posix } from 'pathe'

interface RelationDefinition {
  type: 'ancestor' | 'child' | 'descendant' | 'parent'
  target?: unknown
  linked?: (target: HeadlessComponentInstance) => void
  unlinked?: (target: HeadlessComponentInstance) => void
}

interface RelationState {
  definition: RelationDefinition
  targets: HeadlessComponentInstance[]
}

const states = new WeakMap<HeadlessComponentInstance, Map<string, RelationState>>()
const opposite = { ancestor: 'descendant', descendant: 'ancestor', parent: 'child', child: 'parent' } as const

function definitions(instance: HeadlessComponentInstance): Array<[string, RelationDefinition]> {
  return Object.entries(instance.__definition__?.relations ?? {})
}

function includesBehavior(behaviors: unknown, target: unknown): boolean {
  return Array.isArray(behaviors) && behaviors.some(behavior => behavior === target
    || (behavior && typeof behavior === 'object' && includesBehavior(behavior.behaviors, target)))
}

function matches(source: HeadlessComponentInstance, key: string, relation: RelationDefinition, target: HeadlessComponentInstance) {
  if (relation.target) {
    return includesBehavior(target.__definition__?.behaviors, relation.target)
  }
  const targetPath = key.startsWith('/')
    ? key.slice(1)
    : posix.join(posix.dirname(String(source.is)), key)
  return posix.normalize(targetPath) === target.is
}

export function getComponentRelationNodes(instance: HeadlessComponentInstance, key: string): HeadlessComponentInstance[] {
  return [...(states.get(instance)?.get(key)?.targets ?? [])]
}

function publishRelations(nextStates: Map<HeadlessComponentInstance, Map<string, RelationState>>) {
  const callbacks: Array<() => void> = []
  let changed = false
  for (const [instance, next] of nextStates) {
    const previous = states.get(instance) ?? new Map<string, RelationState>()
    for (const [key, previousState] of previous) {
      const nextTargets = next.get(key)?.targets ?? []
      for (const target of previousState.targets) {
        if (!nextTargets.includes(target)) {
          changed = true
          callbacks.push(() => previousState.definition.unlinked?.call(instance, target))
        }
      }
    }
    for (const [key, nextState] of next) {
      const previousTargets = previous.get(key)?.targets ?? []
      for (const target of nextState.targets) {
        if (!previousTargets.includes(target)) {
          changed = true
          callbacks.push(() => nextState.definition.linked?.call(instance, target))
        }
      }
    }
    states.set(instance, next)
  }
  // 双方查询先指向同一批新关系，再派发生命周期，避免回调看见半更新的关系表。
  for (const callback of callbacks) {
    callback()
  }
  return changed
}

export function syncComponentRelations(
  cache: Map<string, HeadlessComponentInstance>,
  activeScopeIds: Set<string>,
  pageScopeId: string,
) {
  const entries = [...cache].filter(([scopeId]) => activeScopeIds.has(scopeId))
  const nextStates = new Map<HeadlessComponentInstance, Map<string, RelationState>>()
  for (const [scopeId, instance] of cache) {
    if (!scopeId.startsWith(`${pageScopeId}/`) && !activeScopeIds.has(scopeId)) {
      continue
    }
    const next = new Map<string, RelationState>()
    nextStates.set(instance, next)
    if (!activeScopeIds.has(scopeId)) {
      continue
    }
    for (const [key, relation] of definitions(instance)) {
      const upward = relation.type === 'parent' || relation.type === 'ancestor'
      const candidates = entries.filter(([targetScopeId, target]) => {
        if (target === instance) {
          return false
        }
        const ancestor = upward ? targetScopeId : scopeId
        const descendant = upward ? scopeId : targetScopeId
        if (!descendant.startsWith(`${ancestor}/`)) {
          return false
        }
        if ((relation.type === 'parent' || relation.type === 'child') && entries.some(([between]) =>
          between !== ancestor && between !== descendant && between.startsWith(`${ancestor}/`) && descendant.startsWith(`${between}/`))) {
          return false
        }
        return matches(instance, key, relation, target)
          && definitions(target).some(([otherKey, other]) => other.type === opposite[relation.type] && matches(target, otherKey, other, instance))
      })
      if (upward) {
        candidates.sort(([left], [right]) => right.length - left.length)
      }
      next.set(key, { definition: relation, targets: candidates.map(([, target]) => target) })
    }
  }
  return publishRelations(nextStates)
}

export function detachComponentRelations(instances: HeadlessComponentInstance[]) {
  const removed = new Set(instances)
  const nextStates = new Map<HeadlessComponentInstance, Map<string, RelationState>>()
  for (const instance of instances) {
    nextStates.set(instance, new Map())
    for (const relation of states.get(instance)?.values() ?? []) {
      for (const target of relation.targets) {
        if (!removed.has(target) && !nextStates.has(target)) {
          nextStates.set(target, new Map([...states.get(target) ?? []].map(([key, state]) => [key, {
            ...state,
            targets: state.targets.filter(candidate => !removed.has(candidate)),
          }])))
        }
      }
    }
  }
  publishRelations(nextStates)
}
