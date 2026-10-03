import type { PendingToolCall, SessionSummary } from './session/types.js'
import type { Message, SessionEvent, ToolCall } from './types.js'
import { randomUUID } from 'node:crypto'
import {
  mkdir,
  open,
  readdir,
  readFile,
  truncate,
  unlink,
} from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { hash, stateRoot } from './config.js'
import { redactor, redactValue } from './security.js'
import { readSessionJournal } from './session/reader.js'
import { reduceSession } from './session/reducer.js'
import { inspectSession } from './session/summary.js'

export type { PendingToolCall, SessionSummary } from './session/types.js'

export class Session {
  private sequence = 0
  private handle?: Awaited<ReturnType<typeof open>>
  private readonly redact = redactor()
  readonly events: SessionEvent[] = []
  readonly messages: Message[] = []
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

  async open(resume = false): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const lock = `${this.filename}.lock`
    try {
      this.handle = await open(lock, 'wx', 0o600)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
      const pid = Number(await readFile(lock, 'utf8'))
      if (!Number.isInteger(pid) || pid <= 0) {
        throw new Error(
          'Session lock is invalid; inspect it before removing it.',
        )
      }
      try {
        process.kill(pid, 0)
        throw new Error('Session is already active in another process.')
      }
      catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ESRCH') {
          throw err
        }
      }
      await unlink(lock)
      this.handle = await open(lock, 'wx', 0o600)
    }
    try {
      await this.handle.writeFile(String(process.pid))
      if (resume) {
        const journal = await readSessionJournal(this.filename, this.id)
        const state = reduceSession(journal.events)
        if (journal.incompleteTail) {
          await truncate(this.filename, journal.completeBytes)
        }
        this.sequence = journal.events.at(-1)?.sequence ?? 0
        this.events.length = 0
        this.messages.length = 0
        for (const event of journal.events) {
          this.events.push(event)
        }
        for (const message of state.messages) {
          this.messages.push(message)
        }
      }
      else {
        const file = await open(this.filename, 'wx', 0o600)
        await file.close()
      }
    }
    catch (error) {
      await this.close()
      throw error
    }
  }

  async append(
    type: string,
    data: Record<string, unknown>,
  ): Promise<SessionEvent> {
    const safe = redactValue(data, this.redact)
    const event: SessionEvent = {
      version: 1,
      sessionId: this.id,
      sequence: ++this.sequence,
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
    this.events.push(event)
    if (type === 'message') {
      this.messages.push(safe.message as Message)
    }
    return event
  }

  unresolved(): ToolCall[] {
    return this.recovery()
  }

  recovery(): PendingToolCall[] {
    return reduceSession(this.events).pendingCalls
  }

  async close(): Promise<void> {
    if (!this.handle) {
      return
    }
    await this.handle.close()
    this.handle = undefined
    await unlink(`${this.filename}.lock`).catch(() => {})
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
