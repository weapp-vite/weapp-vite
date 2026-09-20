import type { StatefulHmrOutputFile } from './outputWriter'

/** 快照独占其静态资源，DevEngine 的增量输出只补充新资源与可执行模块。 */
export function selectStatefulHmrAdditionalOutput(
  output: StatefulHmrOutputFile[],
  snapshotOutput: Iterable<StatefulHmrOutputFile>,
): StatefulHmrOutputFile[] {
  const snapshotAssetNames = new Set(
    Array.from(snapshotOutput).filter(item => item.type === 'asset').map(item => item.fileName),
  )
  return output.filter(item => item.type === 'chunk' || !snapshotAssetNames.has(item.fileName))
}
