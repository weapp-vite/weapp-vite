import os from 'node:os'
import CI from 'ci-info'
import { omit } from 'es-toolkit/compat'
import fs from 'fs-extra'
import path from 'pathe'
import { createOrUpdatePackageJson, createOrUpdateProjectConfig, initConfig, initViteConfigFile } from '@/index'

const appsDir = path.resolve(__dirname, '../../../apps')
const fixturesDir = path.resolve(__dirname, './fixtures')
describe.skipIf(CI.isCI)('index', () => {
  it('createOrUpdateProjectConfig', async () => {
    const name = 'noProjectConfig'
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-init-'))
    const p1 = path.resolve(tmpDir, 'project.config.json')
    await createOrUpdateProjectConfig({ root: path.resolve(fixturesDir, name), dest: p1 })
    expect(await fs.pathExists(p1)).toBe(true)
  })

  it.each(['vite-native', 'vite-native-skyline', 'vite-native-ts', 'vite-native-ts-skyline'])('%s', async (name) => {
    const root = path.resolve(appsDir, name)
    const packageContent = await createOrUpdatePackageJson({ root, write: false, command: 'weapp-vite' })
    const projectContent = await createOrUpdateProjectConfig({ root, write: false })

    expect(packageContent).toBeTruthy()
    expect(projectContent).toBeTruthy()
  })

  it.each(['vite-native', 'vite-native-skyline', 'vite-native-ts', 'vite-native-ts-skyline'])('%s no pkg.json', async (name) => {
    const root = path.resolve(appsDir, name)
    const result = await createOrUpdatePackageJson({ root, write: false, command: 'weapp-vite', filename: 'pkg.json' })
    expect(result).toBeTruthy()
  })

  it.each(['vite-native', 'vite-native-skyline', 'vite-native-ts', 'vite-native-ts-skyline'])('%s callback', async (name) => {
    const root = path.resolve(appsDir, name)
    const p0 = path.resolve(fixturesDir, name, 'package1.json')
    const res0 = await createOrUpdatePackageJson({
      root,
      dest: p0,
      command: 'weapp-vite',
      write: false,
      cb(set) {
        set('type', 'module')
      },
    })
    const item = omit(res0, ['devDependencies.weapp-vite'])
    expect(item).toMatchSnapshot()
    const p1 = path.resolve(fixturesDir, name, 'project0.config.json')
    const res1 = await createOrUpdateProjectConfig({ root, dest: p1, write: false })
    expect(res1).toMatchSnapshot()
    expect(fs.existsSync(p0)).toBe(false)
    expect(fs.existsSync(p1)).toBe(false)
  })

  it.each(['vite-native', 'vite-native-skyline', 'vite-native-ts', 'vite-native-ts-skyline'])('%s vite.config.ts', async (name) => {
    const root = path.resolve(appsDir, name)
    const res0 = await initViteConfigFile({
      root,
      write: false,
    })
    expect(res0).toMatchSnapshot()
  })

  it.skip.each(['vite-native', 'vite-native-skyline', 'vite-native-ts', 'vite-native-ts-skyline', 'cjs', 'no-pkg-json'])('%s vite.config.ts', async (name) => {
    const root = path.resolve(fixturesDir, name)
    const res = await initConfig({
      root,
      command: 'weapp-vite',
    })
    expect(res).toBeTruthy()
  })

  it.skip.each(['initConfig', 'fullInit'])('%s initConfig', async (name) => {
    const root = path.resolve(fixturesDir, name)
    const res = await initConfig({
      root,
      command: 'weapp-vite',
    })
    expect(res).toBeTruthy()
  })
})
