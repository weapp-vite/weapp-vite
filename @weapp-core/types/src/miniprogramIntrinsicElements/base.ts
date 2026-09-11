// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json、components.alipay.json、components.tt.json。

export type MiniProgramIntrinsicEventHandler<TReturn = unknown> = { bivarianceHack: (...args: any[]) => TReturn }['bivarianceHack']
export interface MiniProgramIntrinsicElementBaseAttributes {
  id?: string | number
  class?: string | Record<string, unknown> | false | null | undefined | unknown[]
  className?: string | Record<string, unknown> | false | null | undefined | unknown[]
  style?: string | Record<string, string | number | undefined> | false | null | undefined | unknown[]
  hidden?: boolean
  key?: string | number
  onTap?: MiniProgramIntrinsicEventHandler
  catchTap?: MiniProgramIntrinsicEventHandler
  captureBindTap?: MiniProgramIntrinsicEventHandler
  captureCatchTap?: MiniProgramIntrinsicEventHandler
  onTouchStart?: MiniProgramIntrinsicEventHandler
  onTouchMove?: MiniProgramIntrinsicEventHandler
  onTouchEnd?: MiniProgramIntrinsicEventHandler
  [name: `data-${string}`]: unknown
}
