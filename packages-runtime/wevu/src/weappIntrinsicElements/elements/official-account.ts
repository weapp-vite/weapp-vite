// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/official-account.html
 */
export type MiniProgramIntrinsicElementOfficialAccount = MiniProgramIntrinsicElementBaseAttributes & {
  binderror?: MiniProgramIntrinsicEventHandler<unknown>
  bindload?: MiniProgramIntrinsicEventHandler<unknown>
  errMsg?: string
  status?: number
}

export type WeappIntrinsicElementOfficialAccount = MiniProgramIntrinsicElementOfficialAccount
