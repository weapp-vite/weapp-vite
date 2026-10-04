import type { HmrProfileJsonSample } from '../hmr'

export interface HmrExternalObservation {
  sourceFile: string
  writtenAtEpochMs: number
  visibleAtEpochMs: number
}

const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
function difference(whole: unknown, ...parts: unknown[]) {
  return nonnegative(whole) && parts.every(nonnegative)
    && whole >= parts.reduce<number>((sum, value) => sum + (value as number), 0)
    ? whole - parts.reduce<number>((sum, value) => sum + (value as number), 0)
    : null
}

/** 外层时段互不重叠；插件 hook 属于 bundler 内部的嵌套观测，不能再次累加。 */
export function attributeHmrProfile(sample: HmrProfileJsonSample, external?: HmrExternalObservation) {
  const value = (key: keyof HmrProfileJsonSample) => nonnegative(sample[key]) ? sample[key] as number : null
  const phases: Record<string, number | null> = sample.pipeline === 'stateful'
    ? Object.fromEntries((sample.profileMode === 'delivery'
        ? ['sourceToBatchMs', 'deliveryQueueMs', 'prepareMs', 'commitQueueMs', 'commitMs', 'publishMs'] as const
        : ['sourceToBatchMs', 'snapshotBuildMs', 'snapshotPublishMs'] as const).map(key => [key, value(key)]))
    : {
        batchWaitMs: value('batchWaitMs'),
        queueWaitMs: value('queueWaitMs'),
        otherBeforeBuildMs: difference(sample.watchToDirtyMs, sample.batchWaitMs, sample.queueWaitMs),
        bundlerMs: value('bundlerMs'),
      }
  const profileResidualMs = sample.pipeline === 'stateful'
    ? difference(sample.totalMs, ...Object.values(phases))
    : difference(sample.totalMs, sample.watchToDirtyMs, sample.bundlerMs)
  let externalStatus: 'not-observed' | 'matched' | 'unknown' = external ? 'unknown' : 'not-observed'
  let sourceToWatcherMs: number | null = null
  let afterProfileToVisibleMs: number | null = null
  let eventId: string | null = null
  if (external && sample.schemaVersion === 1 && sample.correlation === 'known' && sample.clock?.durations === 'performance.now'
    && nonnegative(sample.clock.timeOrigin) && nonnegative(external.writtenAtEpochMs) && external.visibleAtEpochMs >= external.writtenAtEpochMs) {
    const events = (sample.sourceEvents ?? []).filter(event => event.file?.replaceAll('\\', '/') === external.sourceFile.replaceAll('\\', '/')
      && sample.clock!.timeOrigin + event.receivedAtMs >= external.writtenAtEpochMs
      && sample.clock!.timeOrigin + event.receivedAtMs <= external.visibleAtEpochMs)
    if (events.length === 1 && sample.sourceEvents?.length === 1) {
      const received = sample.clock.timeOrigin + events[0]!.receivedAtMs
      sourceToWatcherMs = received - external.writtenAtEpochMs
      afterProfileToVisibleMs = difference(external.visibleAtEpochMs - received, sample.totalMs)
      eventId = events[0]!.eventId
      externalStatus = afterProfileToVisibleMs === null ? 'unknown' : 'matched'
    }
  }
  return {
    schemaVersion: 1 as const,
    pipeline: sample.pipeline ?? 'standard',
    status: Object.values(phases).every(nonnegative) && profileResidualMs !== null ? 'complete' as const : 'partial' as const,
    phases,
    profileResidualMs,
    external: { status: externalStatus, eventId, sourceToWatcherMs, afterProfileToVisibleMs },
    nestedMetrics: 'hook durations overlap; do not add to outer phases' as const,
  }
}
