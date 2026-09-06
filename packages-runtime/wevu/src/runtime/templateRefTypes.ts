import type { AlipayIntrinsicElements } from '../alipayIntrinsicElements'
import type { TtIntrinsicElements } from '../ttIntrinsicElements'
import type { WeappIntrinsicElements } from '../weappIntrinsicElements'
import type { TemplateRefValue } from './types'

type MiniProgramTemplateRefTagName = keyof AlipayIntrinsicElements | keyof TtIntrinsicElements | keyof WeappIntrinsicElements
type MiniProgramTemplateRefElements = {
  [K in MiniProgramTemplateRefTagName]: TemplateRefValue
}

declare global {
  interface HTMLElementTagNameMap extends MiniProgramTemplateRefElements {}
}

export {}
