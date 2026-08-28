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
  readonly hasTemplate?: boolean
  readonly nonJsonSignature?: string
  readonly scriptSignature?: string
  readonly styleIndependentSignature?: string
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

  const signatures = {
    blockSignatures,
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
    tailwindContentSignature: hashTailwindContentPayload(payload.tailwindContent),
    tailwindTemplateContentSignature: hashTailwindTemplateContentPayload(payload.tailwindContent),
    tailwindScriptContentSignature: hashTailwindScriptContentPayload(payload.tailwindContent),
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
