import type { SFCBlock, SFCDescriptor } from 'vue/compiler-sfc'
import { createHash } from 'node:crypto'
import { parse } from 'vue/compiler-sfc'
import { stripJsonMacroCallsFromCode } from 'wevu/compiler'
import { loadVueSfcSignatureNativeBindingSync, shouldUseNativeVueSfcSignature } from './vueSfcSignatureNative'

interface VueSfcSignaturePayload {
  nonJson: unknown
  script: unknown
  styleIndependent: unknown
  hasTemplate: boolean
}

const JSON_MACRO_HINT_RE = /\bdefine(?:App|Page|Component|Sitemap|Theme)Json\s*\(/
const signaturePayloadCache = new Map<string, VueSfcSignaturePayload | undefined>()

function hashPayload(payload: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16)
}

function serializeAttrs(attrs: SFCBlock['attrs']) {
  return Object.fromEntries(
    Object.entries(attrs)
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

function serializeBlock(block: SFCBlock | null | undefined, content?: string) {
  if (!block) {
    return null
  }

  return {
    type: block.type,
    attrs: serializeAttrs(block.attrs),
    content: content ?? block.content,
  }
}

function stripScriptSetupJsonMacros(content: string, filename: string) {
  try {
    return stripJsonMacroCallsFromCode(content, filename)
  }
  catch {
    return content
  }
}

function buildNonJsonDescriptorPayload(descriptor: SFCDescriptor, filename: string) {
  const scriptSetupContent = descriptor.scriptSetup
    ? stripScriptSetupJsonMacros(descriptor.scriptSetup.content, filename)
    : undefined

  return {
    script: serializeBlock(descriptor.script),
    scriptSetup: serializeBlock(descriptor.scriptSetup, scriptSetupContent),
    template: serializeBlock(descriptor.template),
    styles: descriptor.styles.map(style => serializeBlock(style)),
    customBlocks: descriptor.customBlocks
      .filter(block => block.type !== 'json')
      .map(block => serializeBlock(block)),
  }
}

function buildScriptDescriptorPayload(descriptor: SFCDescriptor, filename: string) {
  const scriptSetupContent = descriptor.scriptSetup
    ? stripScriptSetupJsonMacros(descriptor.scriptSetup.content, filename)
    : undefined

  return {
    script: serializeBlock(descriptor.script),
    scriptSetup: serializeBlock(descriptor.scriptSetup, scriptSetupContent),
  }
}

function buildStyleIndependentDescriptorPayload(descriptor: SFCDescriptor, filename: string) {
  const scriptSetupContent = descriptor.scriptSetup
    ? stripScriptSetupJsonMacros(descriptor.scriptSetup.content, filename)
    : undefined

  return {
    script: serializeBlock(descriptor.script),
    scriptSetup: serializeBlock(descriptor.scriptSetup, scriptSetupContent),
    template: serializeBlock(descriptor.template),
    customBlocks: descriptor.customBlocks
      .filter(block => block.type !== 'json')
      .map(block => serializeBlock(block)),
  }
}

function buildVueSfcSignaturePayloadWithTs(source: string, filename: string): VueSfcSignaturePayload | undefined {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length) {
    return undefined
  }

  return {
    nonJson: buildNonJsonDescriptorPayload(descriptor, filename),
    script: buildScriptDescriptorPayload(descriptor, filename),
    styleIndependent: buildStyleIndependentDescriptorPayload(descriptor, filename),
    hasTemplate: Boolean(descriptor.template?.content.trim()),
  }
}

function buildVueSfcSignaturePayloadWithNative(source: string): VueSfcSignaturePayload | undefined {
  if (JSON_MACRO_HINT_RE.test(source)) {
    return undefined
  }

  const binding = loadVueSfcSignatureNativeBindingSync()
  if (!binding) {
    return undefined
  }

  const payload = binding.getVueSfcSignaturePayloadNative(source)
  if (!payload) {
    return undefined
  }

  try {
    return JSON.parse(payload) as VueSfcSignaturePayload
  }
  catch {
    return undefined
  }
}

function buildVueSfcSignaturePayload(source: string, filename: string) {
  const cacheKey = `${filename}\0${source}\0${shouldUseNativeVueSfcSignature() ? 'native' : 'ts'}`
  if (signaturePayloadCache.has(cacheKey)) {
    return signaturePayloadCache.get(cacheKey)
  }

  const nativePayload = buildVueSfcSignaturePayloadWithNative(source)
  if (nativePayload) {
    signaturePayloadCache.set(cacheKey, nativePayload)
    return nativePayload
  }

  const tsPayload = buildVueSfcSignaturePayloadWithTs(source, filename)
  signaturePayloadCache.set(cacheKey, tsPayload)
  return tsPayload
}

export function resolveVueSfcNonJsonSignature(source: string, filename: string) {
  const payload = buildVueSfcSignaturePayload(source, filename)
  return payload ? hashPayload(payload.nonJson) : undefined
}

export function resolveVueSfcScriptSignature(source: string, filename: string) {
  const payload = buildVueSfcSignaturePayload(source, filename)
  return payload ? hashPayload(payload.script) : undefined
}

export function resolveVueSfcStyleIndependentSignature(source: string, filename: string) {
  const payload = buildVueSfcSignaturePayload(source, filename)
  return payload ? hashPayload(payload.styleIndependent) : undefined
}

export function resolveVueSfcHasTemplate(source: string, filename: string) {
  return buildVueSfcSignaturePayload(source, filename)?.hasTemplate
}
