// 此文件由 scripts/generate-intrinsic-elements.mjs 自动生成，请勿直接修改。 来源：components.weapp.json、components.alipay.json、components.tt.json。

import type { MiniProgramIntrinsicElementBaseAttributes } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/text.html
 * @see https://opendocs.alipay.com/mini/component/text
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/component/basic-content/text
 */
export type MiniProgramIntrinsicElementText = MiniProgramIntrinsicElementBaseAttributes & {
  decode?: boolean
  selectable?: boolean
  space?: 'emsp' | 'ensp' | 'nbsp'
}
