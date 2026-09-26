import type { VueSfcSignaturePayload } from './sfcPayload'
import { createHash } from 'node:crypto'
import { resolveVueSfcSignaturePayload } from './sfcPayload'
import {
  hashTailwindContentPayload,
  hashTailwindScriptContentPayload,
  hashTailwindTemplateContentPayload,
} from './tailwindContent'

export const VUE_SFC_BLOCK_TYPES = ['script', 'template', 'style', 'config'] as const

export type VueSfcBlockType = typeof VUE_SFC_BLOCK_TYPES[number]
export type VueSfcBlockSignatures = Readonly<Record<VueSfcBlockType, string>>
export type VueSfcBlockChanges = VueSfcBlockType[]

export interface VueSfcHmrSignatures {
  readonly blockSignatures?: VueSfcBlockSignatures
  /**
   * 按 compiler provider 归属的内容签名，供宿主在不依赖具体 provider 名称的情况下维护 HMR 状态。
   */
  readonly contentSignatures?: Readonly<Record<string, string>>
  readonly hasTemplate?: boolean
  readonly nonJsonSignature?: string
  readonly scriptSignature?: string
  readonly styleIndependentSignature?: string
  /** 按 provider 归属的模板内容签名。 */
  readonly templateContentSignatures?: Readonly<Record<string, string>>
  /** 按 provider 归属的脚本内容签名。 */
  readonly scriptContentSignatures?: Readonly<Record<string, string>>
  readonly tailwindContentSignature?: string
  readonly tailwindScriptContentSignature?: string
  readonly tailwindTemplateContentSignature?: string
}
const hmrSignaturesCache = new WeakMap<VueSfcSignaturePayload, VueSfcHmrSignatures>()

function hashPayload(payload: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16)
}

export function resolveVueSfcHmrSignatures(source: string, filename: string): VueSfcHmrSignatures {
  const payload = resolveVueSfcSignaturePayload(source, filename)
  if (!payload) {
    return {}
  }
  const cached = hmrSignaturesCache.get(payload)
  if (cached) {
    return cached
  }

  const blockSignatures = {
    script: hashPayload(payload.script),
    template: hashPayload(payload.template),
    style: hashPayload(payload.style),
    config: hashPayload(payload.config),
  } satisfies VueSfcBlockSignatures

  const tailwindContentSignature = hashTailwindContentPayload(payload.tailwindContent)
  const tailwindTemplateContentSignature = hashTailwindTemplateContentPayload(payload.tailwindContent)
  const tailwindScriptContentSignature = hashTailwindScriptContentPayload(payload.tailwindContent)
  const signatures = {
    blockSignatures,
    contentSignatures: {
      tailwindcss: tailwindContentSignature,
    },
    nonJsonSignature: hashPayload([
      blockSignatures.script,
      blockSignatures.template,
      blockSignatures.style,
    ]),
    scriptSignature: blockSignatures.script,
    styleIndependentSignature: hashPayload([
      blockSignatures.script,
      blockSignatures.template,
      blockSignatures.config,
    ]),
    scriptContentSignatures: {
      tailwindcss: tailwindScriptContentSignature,
    },
    tailwindContentSignature,
    tailwindScriptContentSignature,
    tailwindTemplateContentSignature,
    templateContentSignatures: {
      tailwindcss: tailwindTemplateContentSignature,
    },
    hasTemplate: payload.hasTemplate,
  } satisfies VueSfcHmrSignatures
  hmrSignaturesCache.set(payload, signatures)
  return signatures
}
export function classifyVueSfcBlockChanges(
  previous: VueSfcBlockSignatures,
  current: VueSfcBlockSignatures,
): VueSfcBlockChanges {
  return VUE_SFC_BLOCK_TYPES.filter(type => previous[type] !== current[type])
}

export function resolveVueSfcNonJsonSignature(source: string, filename: string) {
  return resolveVueSfcHmrSignatures(source, filename).nonJsonSignature
}

export function resolveVueSfcScriptSignature(source: string, filename: string) {
  return resolveVueSfcHmrSignatures(source, filename).blockSignatures?.script
}

export function resolveVueSfcStyleIndependentSignature(source: string, filename: string) {
  return resolveVueSfcHmrSignatures(source, filename).styleIndependentSignature
}

export function resolveVueSfcTailwindContentSignature(source: string, filename: string) {
  return resolveVueSfcHmrSignatures(source, filename).tailwindContentSignature
}

export function resolveVueSfcHasTemplate(source: string, filename: string) {
  return resolveVueSfcHmrSignatures(source, filename).hasTemplate
}
