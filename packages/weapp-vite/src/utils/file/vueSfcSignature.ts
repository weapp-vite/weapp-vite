import type { SFCBlock, SFCDescriptor } from 'vue/compiler-sfc'
import { createHash } from 'node:crypto'
import { parse } from 'vue/compiler-sfc'
import { stripJsonMacroCallsFromCode } from 'wevu/compiler'

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

export function resolveVueSfcNonJsonSignature(source: string, filename: string) {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length) {
    return undefined
  }

  return hashPayload(buildNonJsonDescriptorPayload(descriptor, filename))
}
