import fs from 'fs-extra'
import { posix as path } from 'pathe'
import { assert } from 'vitest'
import { bundleRequire } from '@/index'

it('main', async () => {
  const { mod } = await bundleRequire({
    cwd: __dirname,
    filepath: './fixture/input.ts',
  })
  assert.equal(mod.default.a.filename.endsWith('a.ts'), true)
  // assert.deepEqual(dependencies, ['test/fixture/a.ts', 'test/fixture/input.ts'])
})

it('preserveTemporaryFile', async () => {
  await bundleRequire({
    filepath: path.join(
      __dirname,
      './fixture/preserve-temporary-file/input.ts',
    ),
    preserveTemporaryFile: true,
    getOutputFile: () => {
      return path.resolve(__dirname, './fixture/preserve-temporary-file/input.bundled.mjs')
    },
  })
  const outputFile = path.join(
    __dirname,
    './fixture/preserve-temporary-file/input.bundled.mjs',
  )
  assert.equal(fs.existsSync(outputFile), true)
  fs.unlinkSync(outputFile)
})

it('ignore node_modules', async () => {
  try {
    await bundleRequire({
      filepath: path.join(__dirname, './fixture/ignore-node_modules/input.ts'),
    })
  }
  catch (error: any) {
    assert.equal(error.code, 'ERR_MODULE_NOT_FOUND')
  }
})

it('resolve tsconfig paths', async () => {
  const { mod } = await bundleRequire({
    filepath: path.join(__dirname, './fixture/resolve-tsconfig-paths/input.ts'),
    cwd: path.join(__dirname, './fixture/resolve-tsconfig-paths'),
  })
  assert.equal(mod.foo, 'foo')
})

it('replace import.meta.url', async () => {
  const dir = path.join(__dirname, './fixture/replace-path')
  const { mod } = await bundleRequire({
    filepath: path.join(dir, 'input.ts'),
    cwd: dir,
  })
  assert.equal(mod.dir, dir)
  assert.equal(mod.file, path.join(dir, 'input.ts'))
  assert.equal(mod.importMetaUrl, `file://${path.join(dir, 'input.ts')}`)
})

it.skip('custom readFile', async () => {
  const { mod } = await bundleRequire({
    filepath: '/tmp/foo.ts',
    rolldownOptions: {

    },
    // readFile: (filepath) => {
    //   return `export default "${filepath}"`
    // },
  })
  assert.equal(mod.default, '/tmp/foo.ts')
})
