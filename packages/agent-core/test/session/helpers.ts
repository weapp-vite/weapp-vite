import type { SessionEvent } from '../../src/types.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { Session } from '../../src/session.js'

export type JournalRow = [type: string, data: Record<string, unknown>]

export async function journal(root: string, id: string, rows: JournalRow[], timestamp = '2026-01-01T00:00:00.000Z'): Promise<Session> {
  const session = new Session(root, id)
  await mkdir(session.directory, { recursive: true })
  const events: SessionEvent[] = rows.map(([type, data], index) => ({
    version: 1,
    sessionId: id,
    sequence: index + 1,
    timestamp,
    type,
    data,
  }))
  await writeFile(session.filename, events.map(event => `${JSON.stringify(event)}\n`).join(''))
  return session
}

export function declared(...ids: string[]): JournalRow {
  return ['message', {
    message: { role: 'assistant', text: '', calls: ids.map(id => ({ id, name: 'shell', input: { command: 'echo hello' } })) },
  }]
}

export function completed(id: string): JournalRow {
  return ['message', { message: { role: 'tool', name: 'shell', callId: id, result: { text: 'done' } } }]
}
