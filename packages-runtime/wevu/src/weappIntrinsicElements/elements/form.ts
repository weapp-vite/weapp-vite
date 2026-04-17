// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/form.html
 */
export type MiniProgramIntrinsicElementForm = MiniProgramIntrinsicElementBaseAttributes & {
  bindreset?: MiniProgramIntrinsicEventHandler<unknown>
  bindsubmit?: MiniProgramIntrinsicEventHandler<unknown>
  bindsubmitToGroup?: MiniProgramIntrinsicEventHandler<unknown>
  name?: string
  'report-submit'?: boolean
  'report-submit-timeout'?: number
  value?: unknown
}

export type WeappIntrinsicElementForm = MiniProgramIntrinsicElementForm
