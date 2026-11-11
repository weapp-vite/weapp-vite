import { execFile as execFileCallback } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { afterEach, expect, it } from 'vitest'
import { createDevProcessEnv } from '../../e2e/utils/dev-process-env'
import { NATIVE_PUBLICATION_PREFIX } from '../../e2e/utils/nativePublication/files'
import { loadViteConfigFile } from '../../packages/weapp-vite/src/utils/loadViteConfigFile'
import { createWorkspaceNativePublicationConfig } from './nativePublicationConfig'
import { readWorkspaceHmrProjectTarget } from './projectTarget'

const execFile = promisify(execFileCallback)
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(files: Record<string, string> = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workspace-publication-config-'))
  roots.push(root)
  for (const [file, source] of Object.entries({ 'package.json': '{"type":"module"}', ...files })) {
    await writeFile(path.join(root, file), source)
  }
  const wrapper = await createWorkspaceNativePublicationConfig({ root, sourceRoot: path.join(root, 'miniprogram') }, path.join(root, '.weapp-vite/hmr-profile.jsonl'))
  return { root, wrapper }
}

async function load(root: string, configFile: string) {
  return loadViteConfigFile({ command: 'serve', mode: 'development' }, configFile, root, undefined, undefined, 'runner')
}

it('keeps default Vite priority, resolves each factory once, and merges the separate overlay in dev mode', async () => {
  const { root, wrapper } = await fixture({
    'vite.config.ts': 'export default async env => ({ define: { BASE: env.command, MODE: env.mode }, plugins: [{ name: "base" }], weapp: { platform: "weapp" } })',
    'vite.config.mjs': 'throw new Error("lower-priority config must not load")',
    'weapp-vite.config.mjs': 'export default Promise.resolve({ define: { OVERLAY: "kept" }, plugins: [{ name: "overlay" }], weapp: { platform: "tt" } })',
  })
  const original = await readFile(path.join(root, 'vite.config.ts'), 'utf8')
  const loaded = await load(root, wrapper.configFile)
  expect(loaded?.config.weapp?.platform).toBe('tt')
  expect(loaded?.config.define).toEqual({ BASE: 'serve', MODE: 'development', OVERLAY: 'kept' })
  expect(loaded?.config.plugins).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'base' }), expect.objectContaining({ name: 'overlay' }), expect.objectContaining({ name: 'e2e:native-publication' })]))
  expect(await readFile(path.join(root, 'vite.config.ts'), 'utf8')).toBe(original)
  await Promise.all([wrapper.dispose(), wrapper.dispose()])
  await expect(access(wrapper.configFile)).rejects.toMatchObject({ code: 'ENOENT' })
})

it.each(['vite.config.mts', 'weapp-vite.config.mjs'])('keeps a sole %s and the formal shared default', async (file) => {
  const { root, wrapper } = await fixture({ [file]: 'export default {}' })
  expect(path.dirname(wrapper.configFile)).toBe(root)
  expect((await load(root, wrapper.configFile))?.config.weapp?.platform).toBe('weapp')
})

it('keeps a single default target for an otherwise valid multi-platform config', async () => {
  const { root, wrapper } = await fixture({ 'vite.config.mjs': 'export default { weapp: { multiPlatform: { targets: ["weapp", "tt"] } } }' })
  expect((await load(root, wrapper.configFile))?.config.weapp).toEqual({ platform: 'weapp', multiPlatform: { targets: ['weapp', 'tt'] } })
})

it('preserves factory errors and never substitutes project metadata', async () => {
  const { root, wrapper } = await fixture({
    'vite.config.mjs': 'export default () => { throw new Error("target-config-rejected") }',
    'project.config.json': '{"miniprogramRoot":"dist"}',
  })
  await expect(load(root, wrapper.configFile)).rejects.toThrow('target-config-rejected')
})

it.each([true, false])('observes the actual child target and releases config resources with native write=%s', async (write) => {
  const { root, wrapper } = await fixture({
    'vite.config.mjs': `import { appendFileSync } from 'node:fs'
import { createServer } from 'node:http'
import process from 'node:process'
const record = (event, details = {}) => appendFileSync(new URL('./events.jsonl', import.meta.url), JSON.stringify({ event, pid: process.pid, ...details }) + '\\n')
record('module')
export default async env => {
  if (env.command !== 'serve' || env.mode !== 'development' || process.env.NODE_ENV !== 'development' || process.env.VITEST) throw new Error('wrong-dev-environment')
  const server = createServer((request, response) => response.end('owned-config-resource'))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  record('factory', { port: server.address().port })
  const timer = setInterval(() => {}, 1000)
  return { weapp: { platform: 'tt' }, plugins: [{ name: 'owned-config-resource', async closeBundle() { clearInterval(timer); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); record('closed') } }] }
}`,
  })
  await mkdir(path.join(root, 'miniprogram'))
  await writeFile(path.join(root, 'miniprogram/entry.js'), 'export const value = 1')
  await expect(access(path.join(root, 'events.jsonl'))).rejects.toMatchObject({ code: 'ENOENT' })
  const source = `import { build, loadConfigFromFile } from ${JSON.stringify(import.meta.resolve('vite'))}
const root = ${JSON.stringify(root)}
const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, ${JSON.stringify(wrapper.configFile)}, root, 'silent', undefined, 'runner')
await build({ ...loaded.config, root, configFile: false, logLevel: 'silent', build: { write: ${write}, outDir: 'output/native', lib: { entry: root + '/miniprogram/entry.js', formats: ['es'] } } })
`
  const { stdout } = await execFile(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: root,
    env: createDevProcessEnv({ usePolling: false }),
    timeout: 20_000,
  })
  const events = (await readFile(path.join(root, 'events.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { event: string, pid: number, port?: number })
  expect(events.map(event => event.event)).toEqual(['module', 'factory', 'closed'])
  const childPid = events[0]!.pid
  expect(childPid).not.toBe(process.pid)
  expect(events.every(event => event.pid === childPid)).toBe(true)
  const port = events.find(event => event.event === 'factory')!.port!
  const portStatus = await new Promise<string>((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    const finish = (status: string) => {
      socket.destroy()
      resolve(status)
    }
    socket.once('connect', () => finish('open'))
    socket.once('error', (error: NodeJS.ErrnoException) => finish(error.code ?? 'unknown-error'))
    socket.setTimeout(1_000, () => finish('timeout'))
  })
  expect(portStatus).toBe('ECONNREFUSED')
  expect(await readFile(path.join(root, 'miniprogram/entry.js'), 'utf8')).toBe('export const value = 1')
  expect(readWorkspaceHmrProjectTarget(stdout, { id: wrapper.id, pid: childPid })).toEqual({ platform: 'tt', distRoot: path.join(await realpath(root), 'output/native') })
  if (!write) {
    expect(stdout).not.toContain(NATIVE_PUBLICATION_PREFIX)
    await expect(access(path.join(root, 'output/native'))).rejects.toMatchObject({ code: 'ENOENT' })
  }
  await wrapper.dispose()
}, 30_000)
