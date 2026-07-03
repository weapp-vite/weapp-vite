import type { SFCBlock, SFCDescriptor } from 'vue/compiler-sfc'
import { createHash } from 'node:crypto'
import { parse } from 'vue/compiler-sfc'
import { stripJsonMacroCallsFromCode } from 'wevu/compiler'
import { loadVueSfcSignatureNativeBindingSync, shouldUseNativeVueSfcSignature } from './vueSfcSignatureNative'

interface VueSfcSignaturePayload {
  nonJson: unknown
  script: unknown
  styleIndependent: unknown
  tailwindContent: unknown
  hasTemplate: boolean
}

interface TailwindContentPayload {
  template?: unknown
  scriptLiterals?: unknown
}

export interface VueSfcHmrSignatures {
  nonJsonSignature?: string
  scriptSignature?: string
  styleIndependentSignature?: string
  tailwindContentSignature?: string
  hasTemplate?: boolean
}

const JSON_MACRO_HINT_RE = /\bdefine(?:App|Page|Component|Sitemap|Theme)Json\s*\(/
const JS_STRING_LITERAL_RE = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/
const JS_STRING_LITERALS_RE = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g
const VUE_DYNAMIC_CLASS_BINDING_RE = /(?:^|[\s<])(?:v-bind(?::class)?|:class)(?:\.[\w-]+)*\s*=/
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

function stripJsonMacrosFromScriptContent(content: string, filename: string) {
  try {
    return stripJsonMacroCallsFromCode(content, filename)
  }
  catch {
    return content
  }
}

function buildNonJsonDescriptorPayload(descriptor: SFCDescriptor, filename: string) {
  const scriptSetupContent = descriptor.scriptSetup
    ? stripJsonMacrosFromScriptContent(descriptor.scriptSetup.content, filename)
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
    ? stripJsonMacrosFromScriptContent(descriptor.scriptSetup.content, filename)
    : undefined

  return {
    script: serializeBlock(descriptor.script),
    scriptSetup: serializeBlock(descriptor.scriptSetup, scriptSetupContent),
  }
}

function buildStyleIndependentDescriptorPayload(descriptor: SFCDescriptor, filename: string) {
  const scriptSetupContent = descriptor.scriptSetup
    ? stripJsonMacrosFromScriptContent(descriptor.scriptSetup.content, filename)
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

function collectScriptLiteralCandidates(content: string) {
  const candidates: string[] = []
  for (const match of content.matchAll(JS_STRING_LITERALS_RE)) {
    candidates.push(match[0]!)
  }
  return candidates
}

function normalizeTailwindContentPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload
  }

  const content = payload as TailwindContentPayload
  const template = typeof content.template === 'string' ? content.template : ''
  if (!template || VUE_DYNAMIC_CLASS_BINDING_RE.test(template)) {
    return payload
  }

  return {
    ...content,
    scriptLiterals: [],
  }
}

function hashTailwindContentPayload(payload: unknown) {
  return hashPayload(normalizeTailwindContentPayload(payload))
}

function buildTailwindContentPayload(descriptor: SFCDescriptor, filename: string) {
  const script = descriptor.script
    ? stripJsonMacrosFromScriptContent(descriptor.script.content, filename)
    : ''
  const scriptSetup = descriptor.scriptSetup
    ? stripJsonMacrosFromScriptContent(descriptor.scriptSetup.content, filename)
    : ''
  const scriptLiterals = [
    ...collectScriptLiteralCandidates(script),
    ...collectScriptLiteralCandidates(scriptSetup),
  ]

  return {
    template: descriptor.template?.content ?? '',
    scriptLiterals,
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
    tailwindContent: buildTailwindContentPayload(descriptor, filename),
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
    const parsed = JSON.parse(payload) as VueSfcSignaturePayload
    if (!('tailwindContent' in parsed)) {
      return undefined
    }
    return parsed
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

export function resolveVueSfcTailwindContentSignature(source: string, filename: string) {
  const payload = buildVueSfcSignaturePayload(source, filename)
  if (payload) {
    return hashTailwindContentPayload(payload.tailwindContent)
  }

  if (!JS_STRING_LITERAL_RE.test(source)) {
    return hashPayload(source)
  }

  return undefined
}

export function resolveVueSfcHasTemplate(source: string, filename: string) {
  return buildVueSfcSignaturePayload(source, filename)?.hasTemplate
}

export function resolveVueSfcHmrSignatures(source: string, filename: string): VueSfcHmrSignatures {
  const payload = buildVueSfcSignaturePayload(source, filename)
  if (!payload) {
    return {}
  }

  return {
    nonJsonSignature: hashPayload(payload.nonJson),
    scriptSignature: hashPayload(payload.script),
    styleIndependentSignature: hashPayload(payload.styleIndependent),
    tailwindContentSignature: hashTailwindContentPayload(payload.tailwindContent),
    hasTemplate: payload.hasTemplate,
  }
}
