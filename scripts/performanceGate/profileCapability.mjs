import { historicalBaselineSha } from './historicalBaseline.mjs'

/** 能力例外绑定已核验的历史提交，不能随批准基线滚动，也不能用于候选或 classic。 */
export function hmrProfileCapability(side, commit, runtime) {
  const unavailable = side === 'baseline' && commit === historicalBaselineSha && runtime === 'stateful-experimental'
  return { side, commit, runtime, status: unavailable ? 'unavailable' : 'enabled', reason: unavailable ? 'historical-stateful-producer-absent' : 'profile-collection-requested' }
}
