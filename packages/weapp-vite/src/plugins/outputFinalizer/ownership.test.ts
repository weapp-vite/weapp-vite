import type { CompilerContext } from '../../context'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { prepareOutputOwnership } from './ownership'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('prunes only committed complete output ownership and preserves sibling targets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-output-ownership-'))
  roots.push(root)
  const context = {} as CompilerContext
  const other = {} as CompilerContext
  for (const file of ['home.js', 'removed.js', 'added.js', 'foreign.js']) {
    await writeFile(path.join(root, file), file)
  }
  await prepareOutputOwnership(context, root, ['home.js', 'removed.js'], false)()
  await prepareOutputOwnership(other, root, ['foreign.js'], false)()
  // 未进入 writeBundle 的失败批次不能提交所有权或删除文件。
  prepareOutputOwnership(context, root, ['home.js'], false)
  expect(await readFile(path.join(root, 'removed.js'), 'utf8')).toBe('removed.js')
  await prepareOutputOwnership(context, root, ['added.js'], true)()
  expect(await readFile(path.join(root, 'home.js'), 'utf8')).toBe('home.js')
  await prepareOutputOwnership(context, root, ['home.js', 'added.js'], false)()
  await expect(readFile(path.join(root, 'removed.js'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(path.join(root, 'foreign.js'), 'utf8')).toBe('foreign.js')
  expect(await readFile(path.join(root, 'added.js'), 'utf8')).toBe('added.js')
})

it('forgets explicitly retired partial outputs before a later full build', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'weapp-output-retired-'))
  roots.push(root)
  const context = {} as CompilerContext
  const file = path.join(root, 'removed.wxss')
  await writeFile(file, 'compiled')
  await prepareOutputOwnership(context, root, ['removed.wxss'], false)()
  await prepareOutputOwnership(context, root, [], true, ['removed.wxss'])()
  await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' })
  await writeFile(file, 'now owned by user')
  await prepareOutputOwnership(context, root, [], false)()
  expect(await readFile(file, 'utf8')).toBe('now owned by user')
})
