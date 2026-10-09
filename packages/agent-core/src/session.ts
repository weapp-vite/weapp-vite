import type { SessionLock } from './session/lock.js'
import type { PendingToolCall, SessionSummary } from './session/types.js'
import type { Message, SessionEvent, ToolCall } from './types.js'
import { randomUUID } from 'node:crypto'
import {
  mkdir,
  open,
  readdir,
  truncate,
} from 'node:fs/promises'
import path from 'node:path'
import { hash, stateRoot } from './config.js'
import { redactor, redactValue } from './security.js'
import { acquireSessionLock } from './session/lock.js'
import { readSessionJournal } from './session/reader.js'
import { reduceSession } from './session/reducer.js'
import { inspectSession } from './session/summary.js'

export type { PendingToolCall, SessionSummary } from './session/types.js'

export class Session {
  private sequence = 0
  private lock?: SessionLock
  private opening = false
  private ready = false
  private writes: Promise<void> = Promise.resolve()
  private closing?: Promise<void>
  private readonly redact = redactor()
  readonly events: SessionEvent[] = []
  constructor(
    readonly root: string,
    readonly id: string = randomUUID(),
    readonly directory = path.join(stateRoot(), 'sessions', hash(root)),
  ) {
    if (!/^[\w-]{1,100}$/.test(id)) {
      throw new Error('Invalid session ID')
    }
  }

  get filename(): string {
    return path.join(this.directory, `${this.id}.jsonl`)
  }

  get messages(): Message[] {
    return reduceSession(this.events).messages
  }

  async open(resume = false): Promise<void> {
    if (this.opening || this.lock || this.closing) {
      throw new Error('Session is already open or changing ownership.')
    }
    this.opening = true
    try {
      await mkdir(this.directory, { recursive: true, mode: 0o700 })
      this.lock = await acquireSessionLock(this.filename)
      if (resume) {
        const journal = await readSessionJournal(this.filename, this.id)
        reduceSession(journal.events)
        if (journal.incompleteTail) {
          await truncate(this.filename, journal.completeBytes)
        }
        else if (journal.needsSeparator) {
          const separator = await open(this.filename, 'a', 0o600)
          try {
            await separator.writeFile('\n')
            await separator.sync()
          }
          finally {
            await separator.close()
          }
        }
        this.sequence = journal.events.at(-1)?.sequence ?? 0
        this.events.length = 0
        for (const event of journal.events) {
          this.events.push(event)
        }
      }
      else {
        const file = await open(this.filename, 'wx', 0o600)
        await file.close()
        this.sequence = 0
        this.events.length = 0
      }
      this.writes = Promise.resolve()
      this.ready = true
    }
    catch (error) {
      const lock = this.lock
      this.lock = undefined
      await lock?.release()
      throw error
    }
    finally {
      this.opening = false
    }
  }

  async append(
    type: string,
    data: Record<string, unknown>,
  ): Promise<SessionEvent> {
    const lock = this.lock
    if (!this.ready || !lock) {
      throw new Error('Session must be open before appending events.')
    }
    const safe = redactValue(data, this.redact)
    const write = this.writes.then(async () => {
      await lock.assertOwned()
      const event: SessionEvent = {
        version: 1,
        sessionId: this.id,
        sequence: this.sequence + 1,
        timestamp: new Date().toISOString(),
        type,
        data: safe,
      }
      const fd = await open(this.filename, 'a', 0o600)
      try {
        await fd.writeFile(`${JSON.stringify(event)}\n`)
        await fd.sync()
      }
      finally {
        await fd.close()
      }
      this.sequence = event.sequence
      this.events.push(event)
      return event
    })
    // 写入失败后拒绝后续追加，交由重新打开时的日志校验和尾行修复恢复。
    this.writes = write.then(() => {})
    void this.writes.catch(() => {})
    return write
  }

  unresolved(): ToolCall[] {
    return this.recovery()
  }

  recovery(): PendingToolCall[] {
    return reduceSession(this.events).pendingCalls
  }

  close(): Promise<void> {
    if (this.closing) {
      return this.closing
    }
    if (this.opening) {
      return Promise.reject(new Error('Wait for the session to finish opening before closing it.'))
    }
    const lock = this.lock
    if (!lock) {
      return Promise.resolve()
    }
    this.ready = false
    this.lock = undefined
    this.closing = (async () => {
      try {
        await this.writes
      }
      finally {
        await lock.release()
      }
    })().finally(() => { this.closing = undefined })
    return this.closing
  }

  static async list(root: string): Promise<string[]> {
    try {
      return (await readdir(path.join(stateRoot(), 'sessions', hash(root))))
        .filter(n => n.endsWith('.jsonl'))
        .map(n => n.slice(0, -6))
    }
    catch {
      return []
    }
  }

  static async inspect(root: string, id: string): Promise<SessionSummary> {
    return inspectSession(new Session(root, id).filename, id)
  }

  static async listSummaries(root: string): Promise<SessionSummary[]> {
    const ids = await Session.list(root)
    const summaries = await Promise.all(ids.map(async (id): Promise<SessionSummary> => {
      try {
        return await Session.inspect(root, id)
      }
      catch {
        return {
          sessionId: id,
          updatedAt: null,
          prompt: '',
          status: 'invalid',
          steps: 0,
          usage: { inputTokens: 0, outputTokens: 0 },
          pendingCalls: [],
          diagnostics: ['Could not read this session journal.'],
        }
      }
    }))
    return summaries.sort((a, b) => (b.updatedAt ? Date.parse(b.updatedAt) : -Infinity) - (a.updatedAt ? Date.parse(a.updatedAt) : -Infinity)
      || a.sessionId.localeCompare(b.sessionId))
  }
}
