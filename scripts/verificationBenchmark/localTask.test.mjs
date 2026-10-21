import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { main } from './cli.mjs'
import { captureVerificationSample } from './localCapture.mjs'
import { executeLocalTask } from './localTask.mjs'

const roots = []
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'local-task-')))
  roots.push(root)
  const directory = path.join(root, '.tmp/run')
  await mkdir(path.join(root, 'packages/library'), { recursive: true })
  await writeFile(path.join(root, '.gitignore'), '.tmp/\ndist/\n')
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', packageManager: 'pnpm@12.11.2' }))
  await writeFile(path.join(root, 'source.js'), 'export const source = 1\n')
  await writeFile(path.join(root, 'build.mjs'), `import { mkdir, writeFile } from 'node:fs/promises'
await mkdir('packages/library/dist', { recursive: true })
await writeFile('packages/library/dist/index.js', process.argv[2])
process.stdout.write('built artifact\\n')
process.stderr.write('diagnostic\\n')
`)
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim()
  git(['init', '--initial-branch=main'])
  git(['add', '.'])
  git(['-c', 'user.name=Verification Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'test fixture'])
  for (const [key, value] of Object.entries({ ROOT: root, DIR: directory, RUN: 'task-fixture', MODE: 'full', PNPM: 'pnpm@12.11.2' })) {
    vi.stubEnv(`WEAPP_VITE_VERIFICATION_LOCAL_${key}`, value)
  }
  const task = (id, kind, args, dependencies = []) => ({ id, kind, command: process.execPath, args, dependencies, directory: '.' })
  return { root, directory, task }
}

it('observes real child completion, refreshes legal types builds and verifies artifacts before later consumers', async () => {
  const { root, directory, task } = await fixture()
  expect(await executeLocalTask(root, task('build', 'build', ['build.mjs', 'first']), undefined, false)).toMatchObject({ exitCode: 0, execution: 'actual' })
  const first = JSON.parse(await readFile(path.join(directory, 'artifacts/latest.json'), 'utf8'))
  expect(first).toMatchObject({ schemaVersion: 2, files: ['packages/library/dist/index.js'] })
  expect(await executeLocalTask(root, task('types', 'types', ['build.mjs', 'second'], ['build']), undefined, false)).toMatchObject({ exitCode: 0 })
  const second = JSON.parse(await readFile(path.join(directory, 'artifacts/latest.json'), 'utf8'))
  expect(second.checksums).not.toEqual(first.checksums)
  const consumer = task('consumer', 'test', ['-e', 'process.stdout.write("consumer completed\\n")'], ['types'])
  expect(await executeLocalTask(root, consumer, undefined, false)).toMatchObject({ exitCode: 0 })
  await writeFile(path.join(root, 'packages/library/dist/index.js'), 'unexpected mutation')
  await expect(executeLocalTask(root, consumer, undefined, false)).rejects.toThrow(/checksum/)
  const names = await readdir(path.join(directory, 'tasks'))
  const receipts = await Promise.all(names.map(async name => JSON.parse(await readFile(path.join(directory, 'tasks', name, 'receipt.json'), 'utf8'))))
  expect(receipts).toHaveLength(4)
  const build = receipts.find(item => item.taskId === 'build')
  expect(await readFile(path.join(root, build.stdout.path), 'utf8')).toBe('built artifact\n')
  expect(await readFile(path.join(root, build.stderr.path), 'utf8')).toBe('diagnostic\n')
  expect(receipts.find(item => item.error)).toMatchObject({ taskId: 'consumer', exitCode: 1, cancelled: false })
})

it('retains real process failure without a fabricated artifact manifest', async () => {
  const { root, directory, task } = await fixture()
  expect(await executeLocalTask(root, task('build', 'build', ['-e', 'process.exitCode = 7']), undefined, false)).toMatchObject({ exitCode: 7 })
  await expect(readFile(path.join(directory, 'artifacts/latest.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  const [name] = await readdir(path.join(directory, 'tasks'))
  expect(JSON.parse(await readFile(path.join(directory, 'tasks', name, 'receipt.json'), 'utf8'))).toMatchObject({ exitCode: 7, cancelled: false })
})

it.each(['modify', 'add', 'delete'])('rejects %s of dist by the final consumer after a successful child exit', async (operation) => {
  const { root, task } = await fixture()
  await executeLocalTask(root, task('build', 'build', ['build.mjs', 'prepared']), undefined, false)
  const mutation = operation === 'delete'
    ? 'fs.unlinkSync("packages/library/dist/index.js")'
    : `fs.writeFileSync("packages/library/dist/${operation === 'add' ? 'extra' : 'index'}.js", "unexpected")`
  const consumer = task('final', 'runtime', ['-e', `const fs = require("node:fs"); ${mutation}`], ['build'])
  await expect(executeLocalTask(root, consumer, undefined, false)).rejects.toThrow()
})

it('rejects source mutation even if the child exits successfully', async () => {
  const { root, task } = await fixture()
  await expect(executeLocalTask(root, task('dirty', 'test', ['-e', 'require("node:fs").writeFileSync("source.js", "changed")']), undefined, false)).rejects.toThrow(/clean frozen/)
})

it('routes the public local CLI and refuses arbitrary commands, hand-picked inputs and inherited scope reductions', async () => {
  await expect(main(['local'])).rejects.toThrow(/local requires/)
  const config = { schemaVersion: 1, id: 'sample', variant: 'baseline', mode: 'full', cachePolicy: 'warm', inputPolicy: 'framework-tree-v2' }
  await expect(captureVerificationSample({ ...config, command: 'echo' }, '.tmp/sample.json')).rejects.toThrow(/configuration/)
  await expect(captureVerificationSample({ ...config, inputFiles: ['only-one.ts'] }, '.tmp/sample.json')).rejects.toThrow(/configuration/)
  vi.stubEnv('WEAPP_VITE_E2E_CI_SKIP_HMR_GUARD', '1')
  await expect(captureVerificationSample(config, '.tmp/sample.json')).rejects.toThrow(/partial filters/)
})
