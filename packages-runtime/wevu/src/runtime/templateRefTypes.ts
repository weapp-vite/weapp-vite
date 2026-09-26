import type { AlipayIntrinsicElements } from '@weapp-core/types/alipay'
import type { TtIntrinsicElements } from '@weapp-core/types/tt'
import type { WeappIntrinsicElements } from '@weapp-core/types/weapp'
import type { TemplateRefValue } from './types'

type MiniProgramTemplateRefTagName = keyof AlipayIntrinsicElements | keyof TtIntrinsicElements | keyof WeappIntrinsicElements
type MiniProgramTemplateRefElements = {
  [K in MiniProgramTemplateRefTagName]: TemplateRefValue
}

declare global {
  interface HTMLElementTagNameMap extends MiniProgramTemplateRefElements {}
}

export {}
