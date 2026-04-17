// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/switch.html
 */
export type MiniProgramIntrinsicElementSwitch = MiniProgramIntrinsicElementBaseAttributes & {
  bindchange?: MiniProgramIntrinsicEventHandler<unknown>
  checked?: boolean
  color?: string
  disabled?: boolean
  type?: string
}

export type WeappIntrinsicElementSwitch = MiniProgramIntrinsicElementSwitch
