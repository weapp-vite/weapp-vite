import type { WeappIntrinsicElements } from '../weappIntrinsicElements'
import type { TemplateRefValue } from './types'

type WeappTemplateRefElements = {
  [K in keyof WeappIntrinsicElements]: TemplateRefValue
}

declare global {
  interface HTMLElementTagNameMap extends WeappTemplateRefElements {}
}

export {}
