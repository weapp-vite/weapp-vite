export {}

declare global {
  /** 仅为诊断复用的跨平台运行时源码提供类型；Node VM 不注入支付宝宿主。 */
  const my: Record<string, unknown> | undefined
}
