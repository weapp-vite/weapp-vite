import { deleteAsync } from 'del'
// import { deleteAsync } from 'del'
// import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'

describe('build-npm', () => {
  const targetDir = path.resolve(__dirname, './fixtures/build-npm')

  beforeAll(async () => {
    // await execa('pnpm', ['install'], {
    //   cwd: targetDir,
    //   stdio: 'inherit',
    // })
    await deleteAsync(path.resolve(targetDir, 'dist'))

    const ctx = await createCompilerContext({
      cwd: targetDir,
    })
    await ctx.npmService.build()
  })

  it('should ', async () => {
    expect(
      await fs.pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm'),
      ),
    ).toBe(true)
    expect(
      await fs.pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/@vant'),
      ),
    ).toBe(true)
    expect(
      await fs.pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/@vant/weapp'),
      ),
    ).toBe(true)
    expect(
      await fs.pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/@vant/weapp/action-sheet'),
      ),
    ).toBe(true)

    expect(
      await fs.pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/lodash/index.js'),
      ),
    ).toBe(true)
    expect(
      await fs.pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/tdesign-miniprogram'),
      ),
    ).toBe(true)

    expect(
      await fs.pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/gm-crypto/index.js'),
      ),
    ).toBe(true)
    expect(
      await fs.pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/buffer/index.js'),
      ),
    ).toBe(true)
  })
})
