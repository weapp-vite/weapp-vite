import type { ChangeEvent } from '../../types'
import type { HmrProfileSourceEvent } from '../../utils/hmrProfile/provenance'

export interface HmrSourcePublicationInput {
  readonly root: string
  readonly file: string
  readonly lexicalFile?: string
  readonly version: string
  readonly event?: ChangeEvent
  readonly eventId: string
  readonly receivedAtMs: number
}

export interface HmrSourcePublicationToken {
  readonly root: string
  readonly file: string
  readonly version: string
  readonly event: Readonly<HmrProfileSourceEvent>
}

/** 实际编译输入、原生提交和正式 END 三者共同确认同一保存事件。 */
export class HmrSourcePublicationBuild {
  private readonly versions = new Map<string, string>()
  private readonly unstable = new Set<string>()
  private readonly captured: Set<HmrSourcePublicationToken>
  private committed = false
  private finished = false

  constructor(
    private readonly owner: HmrSourcePublicationOwner,
    private readonly root: string,
    captured: readonly HmrSourcePublicationToken[],
  ) {
    this.captured = new Set(captured)
  }

  recordInput(file: string, version: string): void {
    if (this.finished) {
      return
    }
    const previous = this.versions.get(file)
    if (previous !== undefined && previous !== version) {
      this.unstable.add(file)
    }
    this.versions.set(file, version)
    const observed = this.owner.captureSource(this.root, file)
    if (observed?.version === version) {
      // 只认领在本次真实输入返回前已观察到的保存，不在 END 按相同摘要追认。
      this.captured.add(observed)
    }
  }

  get sourceEvents(): HmrProfileSourceEvent[] {
    return this.provenTokens().map(token => token.event)
  }

  get didCommit(): boolean {
    return this.committed
  }

  markCommitted(): void {
    if (!this.finished) {
      this.committed = true
    }
  }

  finish(successful: boolean): void {
    if (this.finished) {
      return
    }
    this.finished = true
    if (successful && this.committed) {
      this.owner.acknowledge(this.root, this.provenTokens(), new Map([...this.versions].filter(([file]) => !this.unstable.has(file))))
    }
  }

  private provenTokens(): HmrSourcePublicationToken[] {
    return [...this.captured].filter(token => !this.unstable.has(token.file) && this.versions.get(token.file) === token.version)
  }
}

/** 命令级只保存不可变输入身份；编译上下文和完整源码仍属于当前宿主代。 */
export class HmrSourcePublicationOwner {
  private readonly pending = new Map<string, Map<string, HmrSourcePublicationToken>>()
  private readonly published = new Map<string, Map<string, string>>()
  private readonly events = new WeakSet<object>()
  private readonly aliases = new Map<string, Map<string, string>>()
  private closed = false

  observe(input: HmrSourcePublicationInput): HmrSourcePublicationToken | undefined {
    if (this.closed) {
      return
    }
    if (input.lexicalFile) {
      let aliases = this.aliases.get(input.root)
      if (input.lexicalFile === input.file) {
        aliases?.delete(input.lexicalFile)
        if (!aliases?.size) {
          this.aliases.delete(input.root)
        }
      }
      else {
        if (!aliases) {
          aliases = new Map()
          this.aliases.set(input.root, aliases)
        }
        aliases.set(input.lexicalFile, input.file)
      }
    }
    let sources = this.pending.get(input.root)
    const previous = sources?.get(input.file)
    if (previous?.version === input.version && input.event !== 'create') {
      return previous
    }
    if (!previous && input.event !== 'create' && this.published.get(input.root)?.get(input.file) === input.version) {
      return
    }
    if (!sources) {
      sources = new Map()
      this.pending.set(input.root, sources)
    }
    const event = Object.freeze({ eventId: input.eventId, event: input.event, file: input.file, receivedAtMs: input.receivedAtMs })
    const token = Object.freeze({ root: input.root, file: input.file, version: input.version, event })
    sources.set(input.file, token)
    this.events.add(event)
    return token
  }

  invalidate(root: string, file: string, lexicalFile = file): void {
    // 删除后的符号链接已无法 realpath，沿用通知时观察到的 physical 绑定。
    const aliases = this.aliases.get(root)
    const source = aliases?.get(lexicalFile) ?? file
    const pending = this.pending.get(root)
    pending?.delete(source)
    if (!pending?.size) {
      this.pending.delete(root)
    }
    this.published.get(root)?.delete(source)
    aliases?.delete(lexicalFile)
    if (!aliases?.size) {
      this.aliases.delete(root)
    }
  }

  owns(event: HmrProfileSourceEvent): boolean {
    return this.events.has(event)
  }

  /** 已接收或成功编译的来源身份随命令保留，不依赖已退休宿主的模块图。 */
  knowsSource(root: string, file: string): boolean {
    return !this.closed && (this.pending.get(root)?.has(file) === true || this.published.get(root)?.has(file) === true)
  }

  capture(root: string): readonly HmrSourcePublicationToken[] {
    return [...this.pending.get(root)?.values() ?? []]
  }

  captureSource(root: string, file: string): HmrSourcePublicationToken | undefined {
    return this.pending.get(root)?.get(file)
  }

  acknowledge(root: string, tokens: readonly HmrSourcePublicationToken[], versions: ReadonlyMap<string, string>): void {
    if (this.closed) {
      return
    }
    for (const token of tokens) {
      const sources = this.pending.get(token.root)
      // A 的完成不能清除后来观察到的 B，ABA 即使摘要相同也保留新事件身份。
      if (sources?.get(token.file) === token) {
        sources.delete(token.file)
        if (!sources.size) {
          this.pending.delete(token.root)
        }
      }
    }
    let published = this.published.get(root)
    if (!published) {
      published = new Map()
      this.published.set(root, published)
    }
    for (const [file, version] of versions) {
      published.set(file, version)
    }
  }

  begin(root: string): HmrSourcePublicationBuild {
    return new HmrSourcePublicationBuild(this, root, this.capture(root))
  }

  close(): void {
    this.closed = true
    this.pending.clear()
    this.published.clear()
    this.aliases.clear()
  }
}
