import { WEVU_SETUP_READY_KEY } from '@weapp-core/constants'

/** 内部首帧信号必须进入视图，业务字段继续沿用原生纯数据规则。 */
export function preserveSetupReadyInView(options: Record<string, any>) {
  const pattern = options.pureDataPattern
  if (!pattern || typeof pattern.source !== 'string' || typeof pattern.flags !== 'string') {
    return options
  }
  // 克隆后探测，避免修改用户持有的全局或粘连正则状态。
  if (!new RegExp(pattern.source, pattern.flags).test(WEVU_SETUP_READY_KEY)) {
    return options
  }
  return {
    ...options,
    // 将原规则作为整字段匹配的前瞻，额外排除内部信号而不改变其子串匹配规则。
    pureDataPattern: Object.assign(
      new RegExp(`^(?!${WEVU_SETUP_READY_KEY}$)(?=[\\s\\S]*(?:${pattern.source}))[\\s\\S]*$`, pattern.flags),
      { lastIndex: pattern.lastIndex },
    ),
  }
}
