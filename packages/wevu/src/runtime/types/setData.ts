export interface SetDataSnapshotOptions {
  /**
   * setData 策略：
   * - diff：全量快照 + diff（默认，兼容性最好）
   * - patch：按变更路径增量产出 payload（性能更好；在共享引用等场景会自动回退 diff）
   */
  strategy?: 'diff' | 'patch'

  /**
   * 仅下发指定的顶层字段（包含 data/setup 返回值与 computed）。
   * 若为空则默认下发所有字段。
   */
  pick?: string[]

  /**
   * 排除指定的顶层字段（包含 data/setup 返回值与 computed）。
   */
  omit?: string[]

  /**
   * 是否将 computed 的结果参与 setData（默认 true）。
   */
  includeComputed?: boolean

  /**
   * patch 模式阈值：当本轮变更路径数量超过该值时，自动回退到 diff。
   * 说明：大量路径变更时，全量快照 diff 往往更快/更小。
   */
  maxPatchKeys?: number

  /**
   * patch 模式阈值：当本轮 payload 估算字节数超过该值时，自动回退到 diff。
   * 说明：该估算基于 `JSON.stringify(payload).length`，仅用于启发式降级。
   */
  maxPayloadBytes?: number

  /**
   * patch 模式优化：当同一父路径下存在多个子路径变更时，合并为父路径整体下发。
   *
   * 例如：`a.b` 与 `a.c` 同时变更，且 `mergeSiblingThreshold = 2` 时，会下发 `a`。
   *
   * 注意：当子路径包含删除（null）时，为避免删除语义不一致，将不会触发合并。
   */
  mergeSiblingThreshold?: number

  /**
   * 同级合并的“负优化”防护：若合并后的父路径估算体积大于子路径体积之和 * ratio，则不合并。
   */
  mergeSiblingMaxInflationRatio?: number

  /**
   * 同级合并的“负优化”防护：若父路径估算体积超过该值，则不合并。
   */
  mergeSiblingMaxParentBytes?: number

  /**
   * 是否在父值为数组时跳过同级合并（默认 true）。
   */
  mergeSiblingSkipArray?: boolean

  /**
   * patch 模式优化：computed 变更对比策略。
   *
   * - reference：仅 `Object.is` 比较（最快，可能会多下发）
   * - shallow：仅比较数组/对象第一层（折中）
   * - deep：深比较（可能较慢，适合小对象）；会受 `computedCompareMaxDepth/maxKeys` 限制
   */
  computedCompare?: 'reference' | 'shallow' | 'deep'

  /**
   * computed 深比较最大深度（仅在 `computedCompare = "deep"` 时生效）。
   */
  computedCompareMaxDepth?: number

  /**
   * computed 深比较最多比较 key 数（仅在 `computedCompare = "deep"` 时生效）。
   */
  computedCompareMaxKeys?: number

  /**
   * 限制 patch 模式的预链接（prelinkReactiveTree）开销：最多向下遍历的深度（root 为 0）。
   */
  prelinkMaxDepth?: number

  /**
   * 限制 patch 模式的预链接（prelinkReactiveTree）开销：最多索引的节点数。
   */
  prelinkMaxKeys?: number

  /**
   * setData 调试信息回调（用于观测 patch 命中率/回退原因/payload 大小）。
   */
  debug?: (info: SetDataDebugInfo) => void

  /**
   * debug 触发时机：
   * - fallback：仅在回退 diff / 超阈值时触发（默认）
   * - always：每次 flush 都触发
   */
  debugWhen?: 'fallback' | 'always'

  /**
   * debug 采样率（0-1），用于降低 debug 频率与开销（默认 1）。
   */
  debugSampleRate?: number

  /**
   * patch 模式优化：当某个顶层字段下的变更路径数量过多时，直接提升为顶层字段整体替换。
   */
  elevateTopKeyThreshold?: number

  /**
   * setData 序列化上限：最大递归深度（root 为 0）。超过时将停止深拷贝，保留更浅层结构。
   */
  toPlainMaxDepth?: number

  /**
   * setData 序列化上限：最多处理的对象 key 数（累计）。超过时将停止深拷贝，保留更浅层结构。
   */
  toPlainMaxKeys?: number
}

export interface SetDataDebugInfo {
  mode: 'patch' | 'diff'
  reason: 'patch' | 'diff' | 'needsFullSnapshot' | 'maxPatchKeys' | 'maxPayloadBytes'
  pendingPatchKeys: number
  payloadKeys: number
  estimatedBytes?: number
  bytes?: number
  mergedSiblingParents?: number
  computedDirtyKeys?: number
}
