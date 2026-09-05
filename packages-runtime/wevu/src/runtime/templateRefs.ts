import type { InternalRuntimeState } from './types'
import {
  WEVU_READY_CALLED_KEY,
  WEVU_TEMPLATE_REFS_KEY,
  WEVU_TEMPLATE_REFS_PENDING_KEY,
} from '@weapp-core/constants'
import { nextTick } from '../scheduler'
import { markNoSetData } from './noSetData'
import {
  buildTemplateRefValue,
  createSelectorQuery,
  ensureRefsContainer,
  getTemplateRefMap,
  isComponentRef,
  resolveComponentRefValue,
  resolveTemplateRefTarget,
  updateTemplateRefMapValue,
} from './templateRefs/helpers'

export interface TemplateRefBinding {
  selector: string
  inFor: boolean
  name?: string
  get?: () => unknown
  kind?: 'component' | 'element'
}

type TemplateRefUpdateCallback = () => void
type TemplateRefUpdateRejection = (cause: unknown) => void

interface TemplateRefCompletion {
  onResolved?: TemplateRefUpdateCallback
  onRejected?: TemplateRefUpdateRejection
}

interface TemplateRefOwner {
  generation: number
  current?: TemplateRefBatch
  pending?: TemplateRefBatch
}

interface TemplateRefBatch {
  target: InternalRuntimeState
  assignmentTarget: InternalRuntimeState
  runtime: InternalRuntimeState['__wevu']
  assignmentRuntime: InternalRuntimeState['__wevu']
  owner: TemplateRefOwner
  assignmentOwner: TemplateRefOwner
  assignmentGeneration: number
  completions: TemplateRefCompletion[]
  settled: boolean
}

const templateRefOwners = new WeakMap<InternalRuntimeState, TemplateRefOwner>()

function getTemplateRefOwner(target: InternalRuntimeState) {
  let owner = templateRefOwners.get(target)
  if (!owner) {
    owner = { generation: 0 }
    templateRefOwners.set(target, owner)
  }
  return owner
}

function createTemplateRefBatch(target: InternalRuntimeState, assignmentTarget: InternalRuntimeState) {
  const owner = getTemplateRefOwner(target)
  const assignmentOwner = getTemplateRefOwner(assignmentTarget)
  const batch: TemplateRefBatch = {
    target,
    assignmentTarget,
    runtime: target.__wevu,
    assignmentRuntime: assignmentTarget.__wevu,
    owner,
    assignmentOwner,
    assignmentGeneration: assignmentOwner.generation,
    completions: [],
    settled: false,
  }
  owner.current = batch
  return batch
}

function ownsTemplateRefAssignment(batch: TemplateRefBatch) {
  return !batch.settled
    && batch.owner.current === batch
    && batch.target.__wevu === batch.runtime
    && batch.assignmentTarget.__wevu === batch.assignmentRuntime
    && batch.assignmentOwner.generation === batch.assignmentGeneration
}

function settleTemplateRefBatch(batch: TemplateRefBatch, failed = false, cause?: unknown) {
  if (batch.settled) {
    return
  }
  batch.settled = true
  if (batch.owner.current === batch) {
    batch.owner.current = undefined
  }
  let hasError = failed && !batch.completions.length
  let firstError = cause
  for (const completion of batch.completions) {
    try {
      if (failed) {
        if (completion.onRejected) {
          completion.onRejected(cause)
        }
        else if (!hasError) {
          hasError = true
          firstError = cause
        }
      }
      else {
        completion.onResolved?.()
      }
    }
    catch (error) {
      if (!hasError) {
        hasError = true
        firstError = error
      }
    }
  }
  batch.completions.length = 0
  if (hasError) {
    throw firstError
  }
}

function runTemplateRefBatch(batch: TemplateRefBatch) {
  const { target, assignmentTarget } = batch
  try {
    const bindings = target[WEVU_TEMPLATE_REFS_KEY] as TemplateRefBinding[] | undefined
    if (!ownsTemplateRefAssignment(batch) || !bindings?.length || !target[WEVU_READY_CALLED_KEY] || !target.__wevu) {
      settleTemplateRefBatch(batch)
      return
    }
    const templateRefMap = getTemplateRefMap(assignmentTarget)
    const nodeBindings = bindings.filter(binding => !isComponentRef(binding))
    const componentEntries = bindings
      .filter(binding => isComponentRef(binding))
      .map(binding => ({
        binding,
        value: resolveComponentRefValue(target, binding),
      }))

    const applyEntries = (entries: Array<{ binding: TemplateRefBinding, value: unknown }>) => {
      if (!ownsTemplateRefAssignment(batch)) {
        return
      }
      const refsContainer = ensureRefsContainer(assignmentTarget)
      const nameEntries = new Map<string, { values: unknown[], count: number, hasFor: boolean }>()
      const nextNames = new Set<string>()
      const proxy = batch.runtime?.proxy ?? target
      for (const { binding, value } of entries) {
        if (!ownsTemplateRefAssignment(batch)) {
          return
        }
        const resolved = resolveTemplateRefTarget(assignmentTarget, binding, target)
        if (!ownsTemplateRefAssignment(batch)) {
          return
        }

        if (resolved.type === 'function') {
          if (binding.inFor && Array.isArray(value) && value.length) {
            for (const item of value) {
              if (!ownsTemplateRefAssignment(batch)) {
                return
              }
              resolved.fn.call(proxy, item)
            }
          }
          else {
            resolved.fn.call(proxy, binding.inFor && Array.isArray(value) ? null : value ?? null)
          }
          continue
        }

        if (resolved.type === 'ref') {
          resolved.ref.value = value
          continue
        }

        if (resolved.type === 'name') {
          nextNames.add(resolved.name)
          const entry = nameEntries.get(resolved.name) ?? { values: [], count: 0, hasFor: false }
          entry.count += 1
          entry.hasFor = entry.hasFor || binding.inFor
          if (binding.inFor) {
            if (Array.isArray(value)) {
              entry.values.push(...value)
            }
          }
          else if (value != null) {
            entry.values.push(value)
          }
          nameEntries.set(resolved.name, entry)
        }
      }

      for (const [name, entry] of nameEntries) {
        if (!ownsTemplateRefAssignment(batch)) {
          return
        }
        let nextValue: unknown
        if (!entry.values.length) {
          nextValue = entry.hasFor ? markNoSetData([]) : null
        }
        else if (entry.hasFor || entry.values.length > 1 || entry.count > 1) {
          nextValue = markNoSetData(entry.values)
        }
        else {
          nextValue = entry.values[0]
        }
        refsContainer[name] = nextValue
        if (!ownsTemplateRefAssignment(batch)) {
          return
        }
        updateTemplateRefMapValue(templateRefMap, name, nextValue)
      }

      for (const key of Object.keys(refsContainer)) {
        if (!ownsTemplateRefAssignment(batch)) {
          return
        }
        if (!nextNames.has(key)) {
          delete refsContainer[key]
        }
      }
    }

    const query = nodeBindings.length ? createSelectorQuery(target) : null
    if (!query) {
      applyEntries(componentEntries)
      settleTemplateRefBatch(batch)
      return
    }

    for (const binding of nodeBindings) {
      const nodesRef = binding.inFor ? query.selectAll(binding.selector) : query.select(binding.selector)
      nodesRef.boundingClientRect()
    }

    query.exec((res) => {
      if (batch.settled) {
        return
      }
      try {
        // 过期查询仍释放自己的完成通知，但不能向新一代 runtime 或 slot owner 回写。
        if (ownsTemplateRefAssignment(batch)) {
          const entries = nodeBindings.map((binding, index) => ({
            binding,
            value: buildTemplateRefValue(target, binding, Array.isArray(res) ? res[index] : null),
          }))
          applyEntries([...componentEntries, ...entries])
        }
      }
      catch (cause) {
        settleTemplateRefBatch(batch, true, cause)
        return
      }
      settleTemplateRefBatch(batch)
    })
  }
  catch (cause) {
    // 完成通知本身抛错时不能再次结算，也不能吞掉用户回调错误。
    if (batch.settled) {
      throw cause
    }
    settleTemplateRefBatch(batch, true, cause)
  }
}

function completeEmptyTemplateRefs(target: InternalRuntimeState, onResolved?: TemplateRefUpdateCallback) {
  const owner = templateRefOwners.get(target)
  if (owner) {
    owner.current = undefined
  }
  onResolved?.()
}

export function updateTemplateRefs(
  target: InternalRuntimeState,
  onResolved?: TemplateRefUpdateCallback,
  assignmentTarget: InternalRuntimeState = target,
  onRejected?: TemplateRefUpdateRejection,
) {
  const bindings = target[WEVU_TEMPLATE_REFS_KEY] as TemplateRefBinding[] | undefined
  if (!bindings?.length) {
    completeEmptyTemplateRefs(target, onResolved)
    return
  }
  const batch = createTemplateRefBatch(target, assignmentTarget)
  if (onResolved || onRejected) {
    batch.completions.push({ onResolved, onRejected })
  }
  runTemplateRefBatch(batch)
}

export function scheduleTemplateRefUpdate(
  target: InternalRuntimeState,
  onResolved?: TemplateRefUpdateCallback,
  assignmentTarget: InternalRuntimeState = target,
  onRejected?: TemplateRefUpdateRejection,
) {
  const bindings = target[WEVU_TEMPLATE_REFS_KEY] as TemplateRefBinding[] | undefined
  if (!bindings?.length) {
    completeEmptyTemplateRefs(target, onResolved)
    return
  }
  const owner = getTemplateRefOwner(target)
  const pending = owner.pending
  if (pending && pending.assignmentTarget === assignmentTarget && ownsTemplateRefAssignment(pending)) {
    if (onResolved || onRejected) {
      pending.completions.push({ onResolved, onRejected })
    }
    return
  }
  const batch = createTemplateRefBatch(target, assignmentTarget)
  if (onResolved || onRejected) {
    batch.completions.push({ onResolved, onRejected })
  }
  owner.pending = batch
  target[WEVU_TEMPLATE_REFS_PENDING_KEY] = true
  nextTick(() => {
    if (owner.pending === batch) {
      owner.pending = undefined
      target[WEVU_TEMPLATE_REFS_PENDING_KEY] = false
    }
    runTemplateRefBatch(batch)
  })
}

export function clearTemplateRefs(
  target: InternalRuntimeState,
  assignmentTarget: InternalRuntimeState = target,
) {
  const owner = templateRefOwners.get(target)
  if (owner) {
    owner.generation += 1
    owner.current = undefined
    owner.pending = undefined
    target[WEVU_TEMPLATE_REFS_PENDING_KEY] = false
  }
  const bindings = target[WEVU_TEMPLATE_REFS_KEY] as TemplateRefBinding[] | undefined
  if (!bindings || !bindings.length) {
    return
  }
  const refsContainer = ensureRefsContainer(assignmentTarget)
  const proxy = target.__wevu?.proxy ?? target
  const nextNames = new Set<string>()
  const templateRefMap = getTemplateRefMap(assignmentTarget)

  for (const binding of bindings) {
    const resolved = resolveTemplateRefTarget(assignmentTarget, binding, target)
    const emptyValue = binding.inFor ? markNoSetData([]) : null
    if (resolved.type === 'function') {
      resolved.fn.call(proxy, null)
      continue
    }
    if (resolved.type === 'ref') {
      resolved.ref.value = emptyValue
      continue
    }
    if (resolved.type === 'name') {
      nextNames.add(resolved.name)
      refsContainer[resolved.name] = emptyValue
      updateTemplateRefMapValue(templateRefMap, resolved.name, emptyValue)
    }
  }

  for (const key of Object.keys(refsContainer)) {
    if (!nextNames.has(key)) {
      delete refsContainer[key]
    }
  }
}
