// 此文件由 generate-weapp-intrinsic-elements 基于 components.json 自动生成，请勿直接修改。
/* eslint-disable style/quote-props -- 生成的属性名需要保留引号 */

import type { MiniProgramIntrinsicElementBaseAttributes, MiniProgramIntrinsicEventHandler } from '../base'

/**
 * @see https://developers.weixin.qq.com/miniprogram/dev/component/open-data.html
 */
export type MiniProgramIntrinsicElementOpenData = MiniProgramIntrinsicElementBaseAttributes & {
  binderror?: MiniProgramIntrinsicEventHandler<unknown>
  'default-avatar'?: string
  'default-text'?: string
  lang?: 'en' | 'zh_CN' | 'zh_TW'
  'open-gid'?: string
  type?: 'groupName'
}

export type WeappIntrinsicElementOpenData = MiniProgramIntrinsicElementOpenData
