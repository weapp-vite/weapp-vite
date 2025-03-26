import { createCompilerContext } from '@/createContext'
// import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'

describe('build-npm', () => {
  const targetDir = path.resolve(__dirname, './fixtures/build-npm')

  beforeAll(async () => {
    // await execa('pnpm', ['install'], {
    //   cwd: targetDir,
    //   stdio: 'inherit',
    // })
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
        path.resolve(targetDir, 'dist/miniprogram_npm/dayjs'),
      ),
    ).toBe(true)
    expect(
      await fs.pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/dayjs/index.js'),
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
        path.resolve(targetDir, 'dist/miniprogram_npm/tinycolor2'),
      ),
    ).toBe(true)
    expect(
      await fs.pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/tinycolor2/index.js'),
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
