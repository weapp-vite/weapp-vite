import type { SFCBlock, SFCDescriptor } from 'vue/compiler-sfc'
import type { TailwindContentPayload } from './tailwindContent'
import { isObject } from '@weapp-core/shared'
import { parse } from 'vue/compiler-sfc'
import { loadNativeSfcBindingSync, shouldUseNativeSfc } from '../native'
import { splitJsonMacroCallsFromCode } from '../transform/jsonMacros/rewrite'
import { buildTailwindContentPayload } from './tailwindContent'

interface SerializedSfcBlock {
  attrs: Record<string, boolean | string>
  content: string
  type: string
}

interface RawVueSfcPayload {
  config: {
    customBlocks: SerializedSfcBlock[]
  }
  hasTemplate: boolean
  script: {
    script: SerializedSfcBlock | null
    scriptSetup: SerializedSfcBlock | null
  }
  style: {
    styles: SerializedSfcBlock[]
  }
  template: {
    customBlocks: SerializedSfcBlock[]
    template: SerializedSfcBlock | null
  }
}

export interface VueSfcSignaturePayload extends Omit<RawVueSfcPayload, 'config'> {
  config: RawVueSfcPayload['config'] & {
    macroSources: string[]
  }
  tailwindContent: TailwindContentPayload
}

const signaturePayloadCache = new Map<string, VueSfcSignaturePayload | undefined>()

function serializeAttrs(attrs: SFCBlock['attrs']) {
  return Object.fromEntries(
    Object.entries(attrs)
      .sort(([a], [b]) => a.localeCompare(b)),
  ) as Record<string, boolean | string>
}

function serializeBlock(block: SFCBlock | null | undefined): SerializedSfcBlock | null {
  if (!block) {
    return null
  }

  return {
    type: block.type,
    attrs: serializeAttrs(block.attrs),
    content: block.content,
  }
}

function buildRawVueSfcPayload(descriptor: SFCDescriptor): RawVueSfcPayload {
  const configBlocks: SerializedSfcBlock[] = []
  const templateBlocks: SerializedSfcBlock[] = []
  for (const block of descriptor.customBlocks) {
    const serialized = serializeBlock(block)!
    if (block.type === 'json' || block.type === 'config') {
      configBlocks.push(serialized)
    }
    else {
      templateBlocks.push(serialized)
    }
  }

  return {
    script: {
      script: serializeBlock(descriptor.script),
      scriptSetup: serializeBlock(descriptor.scriptSetup),
    },
    template: {
      template: serializeBlock(descriptor.template),
      customBlocks: templateBlocks,
    },
    style: {
      styles: descriptor.styles.map(style => serializeBlock(style)!),
    },
    config: {
      customBlocks: configBlocks,
    },
    hasTemplate: Boolean(descriptor.template?.content.trim()),
  }
}

function normalizeScriptBlock(block: SerializedSfcBlock | null, filename: string) {
  if (!block) {
    return {
      block: null,
      macroSources: [] as string[],
    }
  }

  try {
    const split = splitJsonMacroCallsFromCode(block.content, filename)
    return {
      block: {
        ...block,
        content: split.stripped,
      },
      macroSources: split.macroSources,
    }
  }
  catch {
    return {
      block,
      macroSources: [] as string[],
    }
  }
}

function normalizeVueSfcPayload(raw: RawVueSfcPayload, filename: string): VueSfcSignaturePayload {
  const script = normalizeScriptBlock(raw.script.script, filename)
  const scriptSetup = normalizeScriptBlock(raw.script.scriptSetup, filename)
  const scriptPayload = {
    script: script.block,
    scriptSetup: scriptSetup.block,
  }

  return {
    ...raw,
    script: scriptPayload,
    config: {
      ...raw.config,
      macroSources: [
        ...script.macroSources,
        ...scriptSetup.macroSources,
      ],
    },
    tailwindContent: buildTailwindContentPayload(
      raw.template.template?.content ?? '',
      script.block?.content ?? '',
      scriptSetup.block?.content ?? '',
    ),
  }
}

function isSerializedSfcBlock(value: unknown): value is SerializedSfcBlock {
  return isObject(value)
    && isObject(value.attrs)
    && Object.values(value.attrs).every(attr => typeof attr === 'boolean' || typeof attr === 'string')
    && typeof value.content === 'string'
    && typeof value.type === 'string'
}

function isSerializedSfcBlockList(value: unknown): value is SerializedSfcBlock[] {
  return Array.isArray(value) && value.every(isSerializedSfcBlock)
}

function parseNativePayload(payload: string): RawVueSfcPayload | undefined {
  try {
    const parsed: unknown = JSON.parse(payload)
    if (
      !isObject(parsed)
      || !isObject(parsed.script)
      || !isObject(parsed.template)
      || !isObject(parsed.style)
      || !isObject(parsed.config)
      || typeof parsed.hasTemplate !== 'boolean'
    ) {
      return undefined
    }

    const script = parsed.script.script
    const scriptSetup = parsed.script.scriptSetup
    const template = parsed.template.template
    if (
      (script !== null && !isSerializedSfcBlock(script))
      || (scriptSetup !== null && !isSerializedSfcBlock(scriptSetup))
      || (template !== null && !isSerializedSfcBlock(template))
      || !isSerializedSfcBlockList(parsed.template.customBlocks)
      || !isSerializedSfcBlockList(parsed.style.styles)
      || !isSerializedSfcBlockList(parsed.config.customBlocks)
    ) {
      return undefined
    }

    return {
      config: {
        customBlocks: parsed.config.customBlocks,
      },
      hasTemplate: parsed.hasTemplate,
      script: {
        script,
        scriptSetup,
      },
      style: {
        styles: parsed.style.styles,
      },
      template: {
        template,
        customBlocks: parsed.template.customBlocks,
      },
    }
  }
  catch {
    return undefined
  }
}

function buildVueSfcSignaturePayloadWithNative(source: string, filename: string) {
  try {
    const payload = loadNativeSfcBindingSync()?.getVueSfcSignaturePayloadNative?.(source)
    if (!payload) {
      return undefined
    }
    const raw = parseNativePayload(payload)
    return raw ? normalizeVueSfcPayload(raw, filename) : undefined
  }
  catch {
    return undefined
  }
}

function buildVueSfcSignaturePayloadWithTs(source: string, filename: string) {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length) {
    return undefined
  }
  return normalizeVueSfcPayload(buildRawVueSfcPayload(descriptor), filename)
}

export function resolveVueSfcSignaturePayload(source: string, filename: string) {
  const cacheKey = `${filename}\0${source}\0${shouldUseNativeSfc() ? 'native' : 'ts'}`
  if (signaturePayloadCache.has(cacheKey)) {
    return signaturePayloadCache.get(cacheKey)
  }

  const payload = shouldUseNativeSfc()
    ? buildVueSfcSignaturePayloadWithNative(source, filename)
    ?? buildVueSfcSignaturePayloadWithTs(source, filename)
    : buildVueSfcSignaturePayloadWithTs(source, filename)
  signaturePayloadCache.set(cacheKey, payload)
  return payload
}
