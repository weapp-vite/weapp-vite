import type { SFCBlock, SFCDescriptor } from 'vue/compiler-sfc'
import type { TailwindContentPayload } from './tailwindContent'
import { parse } from 'vue/compiler-sfc'
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

const signaturePayloadCache = new WeakMap<SFCDescriptor, VueSfcSignaturePayload>()

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

export function resolveVueSfcSignaturePayload(source: string, filename: string) {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length) {
    return undefined
  }
  const cached = signaturePayloadCache.get(descriptor)
  if (cached) {
    return cached
  }

  // 载荷只跟随 Vue 解析结果存活，不能在解析缓存淘汰后继续强持有每次编辑的源码。
  const payload = normalizeVueSfcPayload(buildRawVueSfcPayload(descriptor), filename)
  signaturePayloadCache.set(descriptor, payload)
  return payload
}
