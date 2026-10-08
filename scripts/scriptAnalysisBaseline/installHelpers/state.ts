export interface ScriptBaselineFeatures {
  astReuse: boolean
  propsNoScope: boolean
  pageMetaGate: boolean
  reservedPropsGate: boolean
}

export interface ScriptBaselineMetrics {
  astReuse: number
  astSourceMismatch: number
  astUnavailable: number
  astAlreadyConsumed: number
  astOffered: number
  astNotConsumed: number
  pageMetaSkipped: number
  pageMetaAnalyzed: number
  reservedSkipped: number
  reservedAnalyzed: number
  propsNoScopeVisits: number
}

interface AstTransfer {
  session: object
  source?: string
  take?: () => unknown
  consumed: boolean
}

function emptyMetrics(): ScriptBaselineMetrics {
  return {
    astReuse: 0,
    astSourceMismatch: 0,
    astUnavailable: 0,
    astAlreadyConsumed: 0,
    astOffered: 0,
    astNotConsumed: 0,
    pageMetaSkipped: 0,
    pageMetaAnalyzed: 0,
    reservedSkipped: 0,
    reservedAnalyzed: 0,
    propsNoScopeVisits: 0,
  }
}

/** AST 只归当前编译会话所有；异步编译重叠时也不依赖全局栈或源码缓存。 */
export class ScriptBaselineState {
  readonly transferKey = Symbol('script baseline AST transfer')
  private sessions = new Map<object, Set<AstTransfer>>()
  private metrics = emptyMetrics()

  beginCompile() {
    const session = {}
    this.sessions.set(session, new Set())
    return session
  }

  createTransfer(session: object, source: string | undefined, take: () => unknown) {
    const transfers = this.sessions.get(session)
    if (!transfers) {
      throw new Error('Script baseline transfer has no active owner')
    }
    const transfer: AstTransfer = { session, source, take, consumed: false }
    transfers.add(transfer)
    this.metrics.astOffered++
    return transfer
  }

  takeAst(source: string, transfer?: AstTransfer) {
    if (!transfer || !this.sessions.get(transfer.session)?.has(transfer)) {
      this.metrics.astUnavailable++
      return undefined
    }
    if (transfer.consumed) {
      this.metrics.astAlreadyConsumed++
      this.metrics.astUnavailable++
      return undefined
    }
    transfer.consumed = true
    const take = transfer.take
    transfer.take = undefined
    const original = transfer.source
    transfer.source = undefined
    if (original === undefined) {
      this.metrics.astUnavailable++
      return undefined
    }
    if (source !== original) {
      this.metrics.astSourceMismatch++
      return undefined
    }
    const ast = take?.()
    if (ast === undefined || ast === null) {
      this.metrics.astUnavailable++
      return undefined
    }
    this.metrics.astReuse++
    return ast
  }

  endCompile(session: object) {
    const transfers = this.sessions.get(session)
    if (!transfers) {
      throw new Error('Script baseline compile lifecycle mismatch')
    }
    for (const transfer of transfers) {
      if (!transfer.consumed) {
        this.metrics.astNotConsumed++
      }
      transfer.take = undefined
      transfer.source = undefined
      transfer.consumed = true
    }
    this.sessions.delete(session)
  }

  skipPageMeta(source: string | undefined, mayContainPageMeta: (source: string) => boolean) {
    const skip = typeof source === 'string' && !mayContainPageMeta(source)
    if (skip) {
      this.metrics.pageMetaSkipped++
    }
    else {
      this.metrics.pageMetaAnalyzed++
    }
    return skip
  }

  skipReservedProps(source: string | undefined, warn: unknown) {
    const skip = !source || warn === undefined || warn === null || (!source.includes('defineProps') && !source.includes('\\'))
    if (skip) {
      this.metrics.reservedSkipped++
    }
    else {
      this.metrics.reservedAnalyzed++
    }
    return skip
  }

  visitPropsWithoutScope() {
    this.metrics.propsNoScopeVisits++
  }

  snapshot() {
    return {
      ...this.metrics,
      activeCompiles: this.sessions.size,
      pendingTransfers: [...this.sessions.values()].reduce((sum, transfers) => sum + [...transfers].filter(transfer => !transfer.consumed).length, 0),
    }
  }

  assertIdle() {
    if (this.sessions.size) {
      throw new Error('Script baseline still owns active compilation work')
    }
  }

  reset() {
    this.assertIdle()
    this.metrics = emptyMetrics()
  }

  release() {
    for (const session of this.sessions.keys()) {
      this.endCompile(session)
    }
  }
}
