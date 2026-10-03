import type { ToolContext } from '../src/index.js'

import {
  appendFile,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'

import { tmpdir } from 'node:os'

import path from 'node:path'

import process from 'node:process'

// eslint-disable-next-line e18e/ban-dependencies -- Preserve cross-platform command resolution, cancellation and process cleanup semantics.
import { execa } from 'execa'

import { afterEach, beforeEach, expect, it } from 'vitest'

import {
  configSchema,
  fileTools,
  hash,
  isTrusted,
  projectFingerprint,
  redactValue,
  safePath,
  Session,
  trustProject,
} from '../src/index.js'
import { createTaskScope } from './taskScope'

let root: string

let ctx: ToolContext
let tasks: ReturnType<typeof createTaskScope>

beforeEach(async ({ signal }) => {
  tasks = createTaskScope(signal)
  root = await mkdtemp(path.join(tmpdir(), 'weapp-security-'))

  process.env.WEAPP_AGENT_STATE_DIR = path.join(root, 'state')

  ctx = {
    root,
    trusted: true,
    approve: async () => false,
    signal: tasks.signal,
  }
})

afterEach(async () => {
  await tasks.close()
  delete process.env.WEAPP_AGENT_STATE_DIR

  await rm(root, { recursive: true, force: true })
})

it('blocks traversal, secrets, and symlink escapes, including nonexistent descendants', async () => {
  await expect(safePath(root, '../outside')).rejects.toThrow()

  await expect(safePath(root, '.env')).rejects.toThrow()

  await expect(safePath(root, '.git/config')).rejects.toThrow()

  await symlink(tmpdir(), path.join(root, 'escape'), 'junction')

  await expect(safePath(root, 'escape/new/file')).rejects.toThrow()

  expect(await safePath(root, '.env.example')).toBe(
    path.join(await realpath(root), '.env.example'),
  )
})

it('does not overwrite newly changed or existing files', async () => {
  await writeFile(path.join(root, 'file'), 'user changed')

  const edit = fileTools().find(t => t.name === 'edit_file')!

  await expect(
    edit.execute(
      {
        path: 'file',
        expectedHash: hash('before'),
        oldText: 'before',
        newText: 'after',
      },
      ctx,
    ),
  ).rejects.toThrow('changed')

  const create = fileTools().find(t => t.name === 'create_file')!

  await expect(
    create.execute({ path: 'file', content: 'overwrite' }, ctx),
  ).rejects.toThrow()

  expect(await readFile(path.join(root, 'file'), 'utf8')).toBe('user changed')
})

it('invalidates trust if the configured command or package script changes', async () => {
  const config = configSchema.parse({
    model: { provider: 'openai', name: 'test' },
  })

  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { test: 'vitest' } }),
  )

  const before = await projectFingerprint(root, config)

  await trustProject(root, before)

  expect(await isTrusted(root, before)).toBe(true)

  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { test: 'arbitrary new command' } }),
  )

  expect(await isTrusted(root, await projectFingerprint(root, config))).toBe(
    false,
  )
})

it('redacts structured data without breaking JSON escaping', () => {
  const value = { text: 'key "hello"', array: ['hello'] }

  expect(
    redactValue(value, s => s.replaceAll('hello', '[REDACTED]')),
  ).toEqual({ text: 'key "[REDACTED]"', array: ['[REDACTED]'] })
})

it('prevents concurrent session writers and recovers a torn final record', async () => {
  const session = new Session(root)

  await session.open()

  await session.append('message', { message: { role: 'user', text: '保留' } })

  await expect(new Session(root, session.id).open(true)).rejects.toThrow(
    'already active',
  )

  await session.close()

  await appendFile(session.filename, '{broken')

  const resumed = new Session(root, session.id)

  await resumed.open(true)

  expect(resumed.messages).toHaveLength(1)

  await resumed.append('message', { message: { role: 'user', text: 'next' } })

  await resumed.close()

  expect(
    (await readFile(session.filename, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map(s => JSON.parse(s)),
  ).toHaveLength(2)
})

it('invalidates the current in-memory authorization when disk configuration changes', async () => {
  const config = configSchema.parse({ model: { provider: 'openai', name: 'test' } })

  const file = path.join(root, 'weapp-agent.config.json')

  await writeFile(file, JSON.stringify(config))

  const before = await projectFingerprint(root, config)

  await writeFile(file, JSON.stringify({ ...config, maxSteps: 2 }))

  expect(await projectFingerprint(root, config)).not.toBe(before)
})

// 真实 Git 子进程在 Windows coverage 下曾超过 5 秒；超时时需先取消并等待进程退出再清理仓库。
it('does not execute repository textconv or clean filter commands while reading a Git diff', { timeout: 30_000 }, () => tasks.run(async () => {
  const git = (args: string[]) => tasks.run(() => execa('git', args, { cwd: root, cancelSignal: tasks.signal }))
  await git(['init'])

  await writeFile(path.join(root, '.gitattributes'), '*.txt diff=probe filter=probe\n')

  await writeFile(path.join(root, 'probe.cjs'), 'require(\'node:fs\').writeFileSync(\'unexpected-execution\', \'unsafe\')')

  await writeFile(path.join(root, 'page.txt'), 'before')

  await git(['add', '.gitattributes', 'page.txt'])

  // git_diff 比较工作区与索引，无需提交；在暂存后安装危险配置，避免夹具准备执行探针。
  await appendFile(path.join(root, '.git/config'), '\n[diff "probe"]\n\ttextconv = node probe.cjs\n[filter "probe"]\n\tclean = node probe.cjs\n')

  await writeFile(path.join(root, 'page.txt'), 'after')

  const diff = await tasks.run(() => fileTools().find(t => t.name === 'git_diff')!.execute({}, { ...ctx, trusted: false }))

  expect(diff.text).toContain('+after')

  await expect(readFile(path.join(root, 'unexpected-execution'))).rejects.toThrow()
}))
