const baselineWithoutStatefulProfile = 'e7862e61dd83e3b9e356ac1e176267b31ab298af'

/** 能力例外绑定已核验的历史提交，不能随批准基线滚动，也不能用于候选或 classic。 */
export function hmrProfileCapability(side, commit, runtime) {
  const unavailable = side === 'baseline' && commit === baselineWithoutStatefulProfile && runtime === 'stateful-experimental'
  return { side, commit, runtime, status: unavailable ? 'unavailable' : 'enabled', reason: unavailable ? 'historical-stateful-producer-absent' : 'profile-collection-requested' }
}
