import type { StatefulHmrOutputFile } from './outputWriter'
import { APP_PRELUDE_REQUIRE_FILE_BASENAME } from '../../plugins/core/lifecycle/emit/constants'

const preludeSuffix = `/${APP_PRELUDE_REQUIRE_FILE_BASENAME}`

/** Prelude 引用所属构建图的安装器，必须由 DevEngine 发布，不能混用普通快照的 chunk 路径。 */
export function isStatefulHmrSnapshotAsset(
  output: StatefulHmrOutputFile,
): output is Extract<StatefulHmrOutputFile, { type: 'asset' }> {
  return output.type === 'asset'
    && output.fileName !== APP_PRELUDE_REQUIRE_FILE_BASENAME
    && !output.fileName.endsWith(preludeSuffix)
}

/** 快照独占其静态资源；原生可执行模块、prelude 与新增资源由 DevEngine 发布。 */
export function selectStatefulHmrAdditionalOutput(
  output: StatefulHmrOutputFile[],
  snapshotOutput: Iterable<StatefulHmrOutputFile>,
): StatefulHmrOutputFile[] {
  const snapshotAssetNames = new Set(
    Array.from(snapshotOutput).filter(isStatefulHmrSnapshotAsset).map(item => item.fileName),
  )
  return output.filter(item => item.type === 'chunk' || !snapshotAssetNames.has(item.fileName))
}
