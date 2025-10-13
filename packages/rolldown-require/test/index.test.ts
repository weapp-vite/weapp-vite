import { platform } from 'node:os'
import fs from 'fs-extra'
import { posix as path } from 'pathe'
import { assert, expect } from 'vitest'
import { bundleRequire } from '@/index'

const isWin = platform() === 'win32'
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

it('collects nested dependencies', async () => {
  const { dependencies } = await bundleRequire({
    filepath: path.join(__dirname, './fixture/dependency-graph/input.ts'),
    cwd: __dirname,
  })
  const normalized = dependencies.map(dep => dep.replaceAll('\\', '/'))
  assert.equal(
    normalized.some(dep => dep.endsWith('fixture/dependency-graph/level-one.ts')),
    true,
  )
  assert.equal(
    normalized.some(dep => dep.endsWith('fixture/dependency-graph/level-two.ts')),
    true,
  )
  assert.equal(
    normalized.some(dep => dep.endsWith('fixture/dependency-graph/level-dynamic.ts')),
    true,
  )
})

it('accepts absolute filepath without cwd', async () => {
  const absolutePath = path.join(__dirname, './fixture/input.ts')
  const { mod } = await bundleRequire({
    filepath: absolutePath,
  })
  assert.equal(mod.default.a.filename.endsWith('a.ts'), true)
})

it.skipIf(isWin)('replace import.meta.url', async () => {
  const dir = path.join(__dirname, './fixture/replace-path')
  const { mod } = await bundleRequire({
    filepath: path.join(dir, 'input.ts'),
    cwd: dir,
  })
  assert.equal(mod.dir.replaceAll('\\', '/'), dir.replaceAll('\\', '/'))
  assert.equal(mod.file.replaceAll('\\', '/'), path.join(dir, 'input.ts').replaceAll('\\', '/'))
  assert.equal(mod.importMetaUrl.replaceAll('\\', '/'), `file://${path.join(dir, 'input.ts')}`.replaceAll('\\', '/'))
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

it('does not mutate the caller options object', async () => {
  const options = {
    filepath: './fixture/input.ts',
    cwd: __dirname,
  }
  await bundleRequire(options)
  assert.deepEqual(options, {
    filepath: './fixture/input.ts',
    cwd: __dirname,
  })
})

it('throws when tsconfig paths support is disabled', async () => {
  await expect(
    bundleRequire({
      filepath: path.join(__dirname, './fixture/resolve-tsconfig-paths/input.ts'),
      cwd: path.join(__dirname, './fixture/resolve-tsconfig-paths'),
      tsconfig: false,
    }),
  ).rejects.toThrow()
})
