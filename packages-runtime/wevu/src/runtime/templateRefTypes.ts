import type { MiniProgramIntrinsicElements } from '../miniprogramIntrinsicElements'
import type { TemplateRefValue } from './types'

type MiniProgramTemplateRefElements = {
  [K in keyof MiniProgramIntrinsicElements]: TemplateRefValue
}

declare global {
  interface HTMLElementTagNameMap extends MiniProgramTemplateRefElements {}
}

export {}
