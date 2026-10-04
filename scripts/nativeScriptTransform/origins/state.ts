import type { DirectiveOwner, InlineOriginArgumentToken, InlineOriginOccurrence, InlineOriginSnapshot, InlineOriginSource, InlineOriginUnsupported, InlineProvenance, OriginAsset, OriginCheck, OriginContext, OriginDirective, OriginNode, OriginTemplate, TemplateOwner } from './types'
import { argumentFragments, argumentTokens } from './fragments'
import { assetIdentity, directiveOwner, generatedCallee, occurrence, parsedCallee, templateOwner } from './owners'

interface Draft {
  owner?: DirectiveOwner
  callee?: InlineOriginOccurrence['callee']
  argumentTokens?: readonly InlineOriginArgumentToken[]
  reason?: string
}

interface OwnedAsset {
  source: InlineOriginSource
  occurrence: InlineOriginOccurrence
  identity: string
}

/** 来源旁表只持有真实编译对象的弱引用；既有 AST、options 与资源均不增写字段。 */
export class InlineOriginState {
  private readonly contexts = new WeakMap<object, OriginCheck<TemplateOwner>>()
  private readonly drafts = new WeakMap<object, Draft>()
  private readonly assets = new WeakMap<object, OwnedAsset>()
  private readonly sources = new Map<string, InlineOriginSource>()
  private readonly occurrences = new Map<string, InlineOriginOccurrence>()
  private readonly unsupported: InlineOriginUnsupported[] = []
  private readonly calls = { templateCalls: 0, directiveCalls: 0, parsedCalls: 0, registeredCalls: 0, requestCalls: 0 }
  private activeTemplate?: OriginCheck<TemplateOwner>
  private activeDirective?: { context: OriginContext, owner: OriginCheck<DirectiveOwner> }
  private disposed = false

  private assertActive() {
    if (this.disposed) {
      throw new Error('Inline origins require an active diagnostic owner')
    }
  }

  private unknown(stage: InlineOriginUnsupported['stage'], reason: string, context?: OriginContext, asset?: OriginAsset, start?: number) {
    this.unsupported.push({ stage, reason, ...(context ? { filename: context.filename.replace(/\\/g, '/') } : {}), ...(asset ? { inlineId: asset.id } : {}), ...(start === undefined ? {} : { expressionStart: start }) })
  }

  template<T>(template: OriginTemplate, filename: string, source: string, resolvedId: string | undefined, execute: () => T): T {
    this.assertActive()
    this.calls.templateCalls++
    const previous = this.activeTemplate
    this.activeTemplate = templateOwner(template, filename, source, resolvedId)
    if ('reason' in this.activeTemplate) {
      this.unknown('template', this.activeTemplate.reason, { filename, source })
    }
    try {
      return execute()
    }
    finally {
      this.activeTemplate = previous
    }
  }

  directive<T>(directive: OriginDirective, context: OriginContext, inlineSource: string, execute: () => T): T {
    this.assertActive()
    this.calls.directiveCalls++
    const template = this.activeTemplate ?? { reason: 'missing-template-owner' }
    const previousContext = this.contexts.get(context)
    let owner: OriginCheck<DirectiveOwner>
    if (previousContext && 'value' in previousContext && 'value' in template && previousContext.value !== template.value) {
      owner = { reason: 'compiler-context-owner-changed' }
    }
    else {
      this.contexts.set(context, template)
      owner = 'value' in template ? directiveOwner(template.value, directive, context, inlineSource) : template
    }
    const previous = this.activeDirective
    this.activeDirective = { context, owner }
    try {
      return execute()
    }
    finally {
      this.drafts.delete(context)
      this.activeDirective = previous
    }
  }

  parsed(source: string, context: OriginContext, parsed: { expression: OriginNode } | null) {
    this.assertActive()
    this.calls.parsedCalls++
    const active = this.activeDirective
    const owner = active?.context === context ? active.owner : { reason: 'missing-directive-owner' }
    if (!parsed) {
      this.drafts.delete(context)
      this.unknown('parse', 'inline-parser-returned-null', context)
      return
    }
    if ('reason' in owner) {
      this.drafts.set(context, { reason: owner.reason })
      return
    }
    const callee = parsedCallee(owner.value, source, parsed.expression)
    this.drafts.set(context, 'value' in callee
      ? { owner: owner.value, callee: callee.value, argumentTokens: argumentTokens(owner.value, parsed.expression) }
      : { owner: owner.value, reason: callee.reason })
  }

  registered(asset: OriginAsset, context: OriginContext, generated: OriginNode | null | undefined) {
    this.assertActive()
    this.calls.registeredCalls++
    const draft = this.drafts.get(context)
    this.drafts.delete(context)
    if (!draft?.owner || !draft.callee || draft.reason) {
      this.unknown('asset', draft?.reason ?? 'missing-original-parse-observation', context, asset, draft?.owner?.expression.start)
      return
    }
    const identity = assetIdentity(asset)
    if (this.assets.has(asset) || identity === undefined || !generatedCallee(asset, generated, draft.callee.name)) {
      this.unknown('asset', 'generated-root-callee-not-owned-context-member', context, asset, draft.owner.expression.start)
      return
    }
    const fragments = draft.argumentTokens && generated
      ? argumentFragments(draft.owner, draft.argumentTokens, generated, asset.expression)
      : undefined
    const entry = occurrence(draft.owner, draft.callee, asset.id, fragments)
    const source = draft.owner.template.source
    this.assets.set(asset, { source, occurrence: entry, identity })
    this.sources.set(source.id, source)
    this.occurrences.set(entry.id, entry)
  }

  requestFor(options: unknown): InlineProvenance | undefined {
    this.assertActive()
    this.calls.requestCalls++
    const entries: unknown = options && typeof options === 'object' ? (options as { inlineExpressions?: unknown }).inlineExpressions : undefined
    if (!Array.isArray(entries)) {
      return undefined
    }
    const sources = new Map<string, InlineOriginSource>()
    const occurrences: InlineOriginOccurrence[] = []
    const ids = new Set<string>()
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') {
        this.unknown('request', 'non-object-inline-asset')
        continue
      }
      const asset = entry as OriginAsset
      if (typeof asset.id === 'string' && ids.has(asset.id)) {
        this.unknown('request', 'duplicate-inline-id', undefined, asset)
        return undefined
      }
      if (typeof asset.id === 'string') {
        ids.add(asset.id)
      }
      const owned = this.assets.get(asset)
      if (!owned) {
        this.unknown('request', 'inline-asset-has-no-proven-owner', undefined, asset)
        continue
      }
      if (assetIdentity(asset) !== owned.identity) {
        this.unknown('request', 'inline-asset-changed-after-registration', undefined, asset)
        continue
      }
      sources.set(owned.source.id, owned.source)
      occurrences.push(owned.occurrence)
    }
    return occurrences.length
      ? structuredClone({ schemaVersion: 1, coordinateEncoding: 'utf16', sources: [...sources.values()], occurrences })
      : undefined
  }

  snapshot(): Omit<InlineOriginSnapshot, 'loaders'> {
    return structuredClone({ ...this.calls, sourceCount: this.sources.size, occurrenceCount: this.occurrences.size, sources: [...this.sources.values()], occurrences: [...this.occurrences.values()], unsupported: this.unsupported })
  }

  dispose() {
    if (this.activeTemplate || this.activeDirective) {
      throw new Error('Cannot dispose inline origins during a template or directive call')
    }
    this.disposed = true
  }
}
