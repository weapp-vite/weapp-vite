import type { Message, SessionEvent, ToolCall } from './types.js'
import { Buffer } from 'node:buffer'
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
    await this.handle.writeFile(String(process.pid))
    try {
      if (resume) {
        const raw = await readFile(this.filename, 'utf8')
        const end = raw.lastIndexOf('\n') + 1
        const complete = raw.slice(0, end)
        if (end !== raw.length) {
          await truncate(this.filename, Buffer.byteLength(complete))
        }
        for (const line of complete.split('\n').filter(Boolean)) {
          const event = JSON.parse(line) as SessionEvent
          if (
            event.version !== 1
            || event.sessionId !== this.id
            || event.sequence !== this.sequence + 1
          ) {
            throw new Error('Invalid session journal; refusing to replay it.')
          }
          this.sequence = event.sequence
          this.events.push(event)
          if (event.type === 'message') {
            this.messages.push(event.data.message as Message)
          }
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
    const results = new Set(
      this.messages.filter(m => m.role === 'tool').map(m => m.callId),
    )
    return this.messages.flatMap(m =>
      m.role === 'assistant'
        ? (m.calls ?? []).filter(call => !results.has(call.id))
        : [],
    )
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
}
