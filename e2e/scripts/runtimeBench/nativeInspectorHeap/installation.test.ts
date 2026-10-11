import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { readNativeInspectorTarget } from './installation'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function input() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'native-inspector-install-'))
  roots.push(root)
  return path.join(root, 'target.json')
}

it('accepts one atomic operator input for the current session', async () => {
  const filePath = await input()
  const result = readNativeInspectorTarget(filePath, 'current-session')
  const targetUrl = 'http://127.0.0.1:4567/appservice/s0/_sessionId/simulator-app-session-s0/mainframe'
  await fs.writeFile(`${filePath}.tmp`, JSON.stringify({ sessionId: 'current-session', targetUrl }))
  await fs.rename(`${filePath}.tmp`, filePath)
  await expect(result).resolves.toBe(targetUrl)
})

it.each([
  ['previous session', JSON.stringify({ sessionId: 'previous-session', targetUrl: 'old-target' })],
  ['invalid JSON', '{'],
  ['missing target', JSON.stringify({ sessionId: 'current-session' })],
  ['oversized input', ' '.repeat(65_537)],
])('rejects %s without replacing it with a later input', async (_label, text) => {
  const filePath = await input()
  await fs.writeFile(filePath, text)
  await expect(readNativeInspectorTarget(filePath, 'current-session')).rejects.toThrow()
})

it('closes the watcher when installation input times out', async () => {
  const filePath = await input()
  await expect(readNativeInspectorTarget(filePath, 'current-session', 10)).rejects.toThrow('installation input timed out')
  await fs.writeFile(filePath, JSON.stringify({ sessionId: 'current-session', targetUrl: 'late-target' }))
})
