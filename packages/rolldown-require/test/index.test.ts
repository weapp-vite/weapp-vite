import path from 'node:path'
import { assert } from 'vitest'

import { bundleRequire } from '@/index'

it('main', async () => {
  const { mod, dependencies } = await bundleRequire(path.join(__dirname, './fixture/input.ts'))
  expect(typeof mod.default.a.filename === 'string').toBe(true)
  expect(dependencies[0]).toBe('rolldown:runtime')
  expect(dependencies[1].includes('fixture/a.ts')).toBe(true)
  // assert.equal(mod.default.a.filename.endsWith('a.ts'), true)
  // assert.deepEqual(dependencies, ['test/fixture/a.ts', 'test/fixture/input.ts'])
})

it.skip('preserveTemporaryFile', async () => {
  const { mod } = await bundleRequire(path.join(
    __dirname,
    './fixture/preserve-temporary-file/input.ts',
  ))
  expect(typeof mod.a === 'string').toBe(true)
})

it.skip('ignore node_modules', async () => {
  try {
    await bundleRequire(path.join(__dirname, './fixture/ignore-node_modules/input.ts'))
  }
  catch (error: any) {
    assert.equal(error.code, 'ERR_MODULE_NOT_FOUND')
  }
})

it.skip('resolve tsconfig paths', async () => {
  const { mod } = await bundleRequire(path.join(__dirname, './fixture/resolve-tsconfig-paths/input.ts'))
  assert.equal(mod.foo, 'foo')
})

it.skip('replace import.meta.url', async () => {
  const dir = path.join(__dirname, './fixture/replace-path')
  const { mod } = await bundleRequire(path.join(dir, 'input.ts'))
  assert.equal(mod.dir, dir)
  assert.equal(mod.file, path.join(dir, 'input.ts'))
  assert.equal(mod.importMetaUrl, `file://${path.join(dir, 'input.ts')}`)
})
