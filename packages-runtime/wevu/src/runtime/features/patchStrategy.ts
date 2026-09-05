import type { MutationRecord } from '../../reactivity'
import type { SetDataSchedulerOptions } from '../app/setData/scheduler'
import type { RuntimeCapabilityRegistry, SetDataScheduler } from '../capabilities'
import type { SetDataDebugInfo } from '../types'
import { addMutationRecorder, prelinkReactiveTree, removeMutationRecorder, toRaw } from '../../reactivity'
import { clearPatchIndices } from '../../reactivity/reactive'
import { runPatchUpdate } from '../app/setData/patchScheduler'
import { createSetDataScheduler } from '../app/setData/scheduler'
import { registerRuntimeCapability } from '../capabilities'

function createPatchSetDataScheduler(options: SetDataSchedulerOptions): SetDataScheduler {
  const scheduler = createSetDataScheduler(options)
  const stateRootRaw = toRaw(options.state) as object
  const pendingPatches = new Map<string, { kind: 'property' | 'array', op: 'set' | 'delete' }>()
  const fallbackTopKeys = new Set<string>()
  const latestComputedSnapshot: Record<string, unknown> = Object.create(null)
  const needsFullSnapshot = { value: true }
  let started = false
  let disposed = false

  const syncComputedSnapshot = () => {
    if (!options.includeComputed) {
      return
    }
    const snapshot = scheduler.getLatestSnapshot()
    for (const key of Object.keys(options.computedRefs)) {
      if (scheduler.shouldIncludeSnapshotKey(key)) {
        latestComputedSnapshot[key] = snapshot[key]
      }
    }
    options.dirtyComputedKeys.clear()
  }

  const runDiffUpdate = (reason: SetDataDebugInfo['reason'] = 'diff') => {
    pendingPatches.clear()
    fallbackTopKeys.clear()
    needsFullSnapshot.value = false
    const result = scheduler.runDiffUpdate(reason)
    syncComputedSnapshot()
    return result
  }

  const mutationRecorder = (record: MutationRecord) => {
    if (!options.isMounted()) {
      return
    }
    if (record.root !== stateRootRaw) {
      const topKeys = scheduler.resolveTopKeysByRoot(record.root)
      for (const key of topKeys) {
        fallbackTopKeys.add(key)
      }
      return
    }
    if (!record.path) {
      if (Array.isArray(record.fallbackTopKeys) && record.fallbackTopKeys.length) {
        for (const key of record.fallbackTopKeys) {
          fallbackTopKeys.add(key)
        }
      }
      else {
        needsFullSnapshot.value = true
      }
      return
    }
    const topKey = record.path.split('.', 1)[0]
    if (scheduler.shouldIncludeSnapshotKey(topKey)) {
      pendingPatches.set(record.path, { kind: record.kind, op: record.op })
    }
  }

  return {
    job() {
      if (!scheduler.prepareJob(
        pendingPatches.size + fallbackTopKeys.size,
        () => [
          ...pendingPatches.keys(),
          ...fallbackTopKeys,
          ...(options.includeComputed ? options.dirtyComputedKeys : []),
        ],
      )) {
        return
      }
      if (needsFullSnapshot.value) {
        return runDiffUpdate('needsFullSnapshot')
      }
      const hasPatchSignal = pendingPatches.size > 0
        || fallbackTopKeys.size > 0
        || (options.includeComputed && options.dirtyComputedKeys.size > 0)
      if (!hasPatchSignal) {
        return runDiffUpdate('diff')
      }
      return runPatchUpdate({
        state: options.state,
        computedRefs: options.computedRefs,
        dirtyComputedKeys: options.dirtyComputedKeys,
        includeComputed: options.includeComputed,
        computedCompare: options.computedCompare,
        computedCompareMaxDepth: options.computedCompareMaxDepth,
        computedCompareMaxKeys: options.computedCompareMaxKeys,
        currentAdapter: options.currentAdapter,
        shouldIncludeKey: scheduler.shouldIncludeSnapshotKey,
        maxPatchKeys: options.maxPatchKeys,
        maxPayloadBytes: options.maxPayloadBytes,
        mergeSiblingThreshold: options.mergeSiblingThreshold,
        mergeSiblingMaxInflationRatio: options.mergeSiblingMaxInflationRatio,
        mergeSiblingMaxParentBytes: options.mergeSiblingMaxParentBytes,
        mergeSiblingSkipArray: options.mergeSiblingSkipArray,
        elevateTopKeyThreshold: options.elevateTopKeyThreshold,
        toPlainMaxDepth: options.toPlainMaxDepth,
        toPlainMaxKeys: options.toPlainMaxKeys,
        includeFunctions: options.includeFunctions,
        functionPaths: options.functionPaths,
        plainCache: scheduler.plainCache,
        plainCacheEligibility: scheduler.plainCacheEligibility,
        pendingPatches,
        fallbackTopKeys,
        latestSnapshot: scheduler.getLatestSnapshot(),
        latestComputedSnapshot,
        needsFullSnapshot,
        bindingDiagnosticsEnabled: Boolean(options.debug && options.bindingManifest),
        emitDebug: scheduler.emitDebug,
        runDiffUpdate,
      })
    },
    snapshot: scheduler.snapshot,
    cloneLatestSnapshot: scheduler.cloneLatestSnapshot,
    start() {
      if (started) {
        return
      }
      started = true
      prelinkReactiveTree(options.state, {
        shouldIncludeTopKey: options.shouldIncludeKey,
        maxDepth: options.prelinkMaxDepth,
        maxKeys: options.prelinkMaxKeys,
      })
      addMutationRecorder(mutationRecorder)
    },
    dispose() {
      if (!started || disposed) {
        return
      }
      disposed = true
      removeMutationRecorder(mutationRecorder)
      clearPatchIndices(options.state)
    },
  }
}

const patchStrategyHooks: NonNullable<RuntimeCapabilityRegistry['patchStrategy']> = {
  createScheduler: createPatchSetDataScheduler,
}

/**
 * 安装 patch setData 策略。
 */
export function installPatchStrategy(): void {
  registerRuntimeCapability('patchStrategy', patchStrategyHooks)
}
