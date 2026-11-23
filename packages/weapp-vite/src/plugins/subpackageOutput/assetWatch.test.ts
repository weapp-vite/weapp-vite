import { Buffer } from 'node:buffer'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'

it('moves a watched image as consumers change and removes stale outputs', async () => {
  const fixture = await createSubpackageOutputFixture()
  const [main, feature] = fixture.routes
  const source = (file: string) => path.join(fixture.root, 'src', file)
  const dist = path.join(fixture.root, 'dist')
  const featurePage = (value: string) => `Page({ data: { phase: "${value}" } })`
  const mainPage = (phase: string, useImage = false) => useImage
    ? `import image from "../../packages/feature/image.png"; Page({ data: { image, phase: "${phase}" } })`
    : featurePage(phase)
  try {
    await writeFile(source(`${main}.js`), mainPage('initial'))
    await writeFile(source(`${main}.wxss`), '')
    await writeFile(source(`${feature}.js`), featurePage('initial'))
    const watcher = await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: { watch: {}, assetsDir: '[subpackage]/assets', assetsInlineLimit: 0, minify: false },
    })
    if (!('on' in watcher)) {
      throw new Error('Expected a watch build')
    }
    try {
      const waitForBuild = (verify: () => Promise<boolean>, change?: () => Promise<void>) => new Promise<void>((resolve, reject) => {
        let timeout: ReturnType<typeof setTimeout>
        const onEvent: Parameters<typeof watcher.on<'event'>>[1] = async function (event) {
          function finish(error?: unknown) {
            clearTimeout(timeout)
            if (error) {
              reject(error)
            }
            else {
              resolve()
            }
          }
          if (event.code === 'ERROR') {
            watcher.off('event', onEvent)
            finish(event.error)
          }
          if (event.code === 'BUNDLE_END') {
            try {
              if (await verify()) {
                watcher.off('event', onEvent)
                finish()
              }
            }
            catch (error) {
              watcher.off('event', onEvent)
              finish(error)
            }
          }
        }
        timeout = setTimeout(() => {
          watcher.off('event', onEvent)
          reject(new Error('Timed out waiting for the requested watch generation'))
        }, 8_000)
        watcher.on('event', onEvent)
        if (change) {
          void change().catch((error: unknown) => {
            clearTimeout(timeout)
            watcher.off('event', onEvent)
            reject(error)
          })
        }
      })
      const read = (file: string) => readFile(path.join(dist, file), 'utf8')
      const files = async () => (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
      const emitted = async () => (await files()).filter(file => /\/image-[^/]+\.png$/.test(file))
      const expectLocation = async (directory: string) => {
        const images = await emitted()
        expect(images).toHaveLength(1)
        expect(path.dirname(images[0]!)).toBe(directory)
        expect(await read(`${feature}.wxss`)).toContain(`/${images[0]}`)
        expect((await files()).includes('packages/feature/image.png')).toBe(false)
        return images[0]!
      }
      const phase = (value: string) => async () => (await read(`${main}.js`)).includes(value)
      await waitForBuild(phase('initial'))
      const original = await expectLocation('packages/feature/assets')

      await waitForBuild(phase('shared'), () => writeFile(source(`${main}.js`), mainPage('shared', true)))
      const shared = await expectLocation('assets')
      expect(await read(`${main}.js`)).toContain(`/${shared}`)
      expect((await files()).includes(original)).toBe(false)

      await waitForBuild(phase('local-again'), () => writeFile(source(`${main}.js`), mainPage('local-again')))
      expect(await expectLocation('packages/feature/assets')).toBe(original)
      expect((await files()).includes(shared)).toBe(false)

      const image = source('packages/feature/image.png')
      const changedImage = Buffer.concat([await readFile(image), Buffer.from('changed')])
      await waitForBuild(async () => (await emitted()).some(file => file !== original), () => writeFile(image, changedImage))
      const updated = await expectLocation('packages/feature/assets')
      expect(updated).not.toBe(original)
      expect(await readFile(path.join(dist, updated))).toEqual(changedImage)
      expect((await files()).includes(original)).toBe(false)

      await waitForBuild(async () => !(await read(`${feature}.wxss`)).includes('image-'), () => writeFile(source(`${feature}.wxss`), '.page { color: red; }'))
      expect(await emitted()).toEqual([])
    }
    finally {
      await watcher.close()
    }
  }
  finally {
    await fixture.close()
  }
}, 30_000)
