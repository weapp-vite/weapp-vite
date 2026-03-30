import { access, rm } from 'node:fs/promises'
import path from 'pathe'
import { createCompilerContext } from '@/createContext'
import { projectFixturesDir } from './utils'

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  }
  catch {
    return false
  }
}

describe('build-npm', () => {
  const targetDir = path.resolve(projectFixturesDir, 'build-npm')

  beforeAll(async () => {
    // await execa('pnpm', ['install'], {
    //   cwd: targetDir,
    //   stdio: 'inherit',
    // })
    await rm(path.resolve(targetDir, 'dist'), { recursive: true, force: true })

    const ctx = await createCompilerContext({
      cwd: targetDir,
    })
    await ctx.npmService.build()
  })

  it('should ', async () => {
    expect(
      await pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm'),
      ),
    ).toBe(true)
    expect(
      await pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/@vant'),
      ),
    ).toBe(true)
    expect(
      await pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/@vant/weapp'),
      ),
    ).toBe(true)
    expect(
      await pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/@vant/weapp/action-sheet'),
      ),
    ).toBe(true)

    expect(
      await pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/es-toolkit/index.js'),
      ),
    ).toBe(true)

    expect(
      await pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/tdesign-miniprogram'),
      ),
    ).toBe(true)

    expect(
      await pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/gm-crypto/index.js'),
      ),
    ).toBe(true)
    expect(
      await pathExists(
        path.resolve(targetDir, 'dist/miniprogram_npm/buffer/index.js'),
      ),
    ).toBe(true)
  })

  it('dedupes concurrent buildPackage tasks for the same dependency output', async () => {
    await rm(path.resolve(targetDir, 'dist'), { recursive: true, force: true })
    const ctx = await createCompilerContext({
      cwd: targetDir,
    })
    const [mainRelation] = ctx.npmService.getPackNpmRelationList()
    const outDir = path.resolve(targetDir, mainRelation.miniprogramNpmDistDir, 'miniprogram_npm')
    const buildTask = () => ctx.npmService.buildPackage({
      dep: 'tdesign-miniprogram',
      outDir,
      isDependenciesCacheOutdate: true,
    })
    await Promise.all(
      Array.from({ length: 4 }, (_, index) => index).map(() => buildTask()),
    )

    expect(await pathExists(path.resolve(outDir, 'tdesign-miniprogram/button'))).toBe(true)
  })
})
