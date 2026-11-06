import type { CompilerContext } from '../../../context'
import type { ChunkEmitStats } from './chunkEmitter'

interface EntryEmission {
  startedAt: number
  dirtyCount: number
  resolvedCount: number
  pendingCount: number
  emittedCount: number
  registrationCount: number
  emitAll: boolean
  fullScan?: boolean
  sharedChunkResolveMs?: number
  pendingReasonSummary?: string[]
}

export function createChunkEmitStats(): ChunkEmitStats {
  return {
    chunkEmitCount: 0,
    emitFileMs: 0,
    loadCount: 0,
    loadMs: 0,
    skippedLoadedCount: 0,
  }
}

/** 每次入口发射独立计数，完整扫描与局部计划使用同一代账本。 */
export function resetChunkEmitStats(stats: ChunkEmitStats) {
  Object.assign(stats, createChunkEmitStats())
}

export function addChunkEmitStats(target: ChunkEmitStats, source: ChunkEmitStats) {
  target.chunkEmitCount += source.chunkEmitCount
  target.emitFileMs += source.emitFileMs
  target.loadCount += source.loadCount
  target.loadMs += source.loadMs
  target.skippedLoadedCount += source.skippedLoadedCount
}

/** 只在本代入口计划成功后记录观测值，诊断不参与下一代入口选择。 */
export function recordEntryEmissionProfile(
  profile: CompilerContext['runtimeState']['build']['hmr']['profile'],
  stats: ChunkEmitStats,
  emission: EntryEmission,
  debug?: (message: string) => void,
) {
  Object.assign(profile, {
    emitMs: performance.now() - emission.startedAt,
    sharedChunkResolveMs: emission.sharedChunkResolveMs,
    entryChunkLoadMs: stats.loadMs,
    entryChunkEmitFileMs: stats.emitFileMs,
    chunkEmitCount: stats.chunkEmitCount,
    loadCount: stats.loadCount,
    skippedLoadedCount: stats.skippedLoadedCount,
    dirtyCount: emission.dirtyCount,
    pendingCount: emission.pendingCount,
    emittedCount: emission.emittedCount,
    pendingReasonSummary: emission.pendingReasonSummary,
  })
  debug?.(`hmr emit dirty=${emission.dirtyCount} resolved=${emission.resolvedCount} emitAll=${emission.emitAll} pending=${emission.pendingCount} registration=${emission.registrationCount}${emission.fullScan ? ' scan=full' : ''}`)
}
