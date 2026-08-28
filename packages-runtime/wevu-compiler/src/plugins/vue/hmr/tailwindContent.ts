import { createHash } from 'node:crypto'
import {
  collectScriptCallStringLiterals,
  collectScriptStringLiterals,
  mayContainScriptCallOrModuleSyntax,
} from '@weapp-vite/ast'

export interface TailwindContentPayload {
  hasScriptTailwindClassHint: boolean
  scriptCallLiterals: string[]
  scriptLiterals: string[]
  template: string
}

const CLASS_LIKE_TEMPLATE_ATTR_RE = /(?:^|[\s<])(?:[\w-]*class[\w-]*|v-bind(?::[\w-]*class[\w-]*)?|:[\w-]*class[\w-]*)(?:\.[\w-]+)*\s*=\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[^\s>]+)/g
const VUE_DYNAMIC_CLASS_LIKE_BINDING_RE = /(?:^|[\s<])(?:v-bind(?::[\w-]*class[\w-]*)?|:[\w-]*class[\w-]*)(?:\.[\w-]+)*\s*=/

function hashPayload(payload: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16)
}

function collectTemplateTailwindCandidates(content: string) {
  const candidates = new Set<string>()
  for (const match of content.matchAll(CLASS_LIKE_TEMPLATE_ATTR_RE)) {
    candidates.add(match[0]!.trim())
  }
  return Array.from(candidates).sort()
}

function normalizeTailwindContentPayload(payload: TailwindContentPayload) {
  const hasDynamicClassLikeBinding = VUE_DYNAMIC_CLASS_LIKE_BINDING_RE.test(payload.template)
  const scriptLiterals = hasDynamicClassLikeBinding
    ? payload.scriptLiterals
    : payload.hasScriptTailwindClassHint
      ? payload.scriptCallLiterals
      : []

  return {
    ...payload,
    template: collectTemplateTailwindCandidates(payload.template),
    scriptLiterals,
    scriptCallLiterals: [],
  }
}

export function buildTailwindContentPayload(
  template: string,
  scriptContent: string,
  scriptSetupContent: string,
): TailwindContentPayload {
  return {
    template,
    scriptLiterals: [
      ...collectScriptStringLiterals(scriptContent),
      ...collectScriptStringLiterals(scriptSetupContent),
    ],
    scriptCallLiterals: [
      ...collectScriptCallStringLiterals(scriptContent),
      ...collectScriptCallStringLiterals(scriptSetupContent),
    ],
    hasScriptTailwindClassHint: mayContainScriptCallOrModuleSyntax(`${scriptContent}\n${scriptSetupContent}`),
  }
}

export function hashTailwindContentPayload(payload: TailwindContentPayload) {
  return hashPayload(normalizeTailwindContentPayload(payload))
}

export function hashTailwindTemplateContentPayload(payload: TailwindContentPayload) {
  return hashPayload({
    template: normalizeTailwindContentPayload(payload).template,
  })
}

export function hashTailwindScriptContentPayload(payload: TailwindContentPayload) {
  return hashPayload({
    scriptLiterals: normalizeTailwindContentPayload(payload).scriptLiterals,
  })
}
