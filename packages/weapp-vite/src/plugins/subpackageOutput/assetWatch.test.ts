import { Buffer } from 'node:buffer'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'
import { waitForAssetBuild } from './watchFixture'

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
      await waitForAssetBuild(watcher, phase('initial'))
      const original = await expectLocation('packages/feature/assets')

      await waitForAssetBuild(watcher, phase('shared'), () => writeFile(source(`${main}.js`), mainPage('shared', true)))
      const shared = await expectLocation('assets')
      expect(await read(`${main}.js`)).toContain(`/${shared}`)
      expect((await files()).includes(original)).toBe(false)

      await waitForAssetBuild(watcher, phase('local-again'), () => writeFile(source(`${main}.js`), mainPage('local-again')))
      expect(await expectLocation('packages/feature/assets')).toBe(original)
      expect((await files()).includes(shared)).toBe(false)

      const image = source('packages/feature/image.png')
      const changedImage = Buffer.concat([await readFile(image), Buffer.from('changed')])
      await waitForAssetBuild(watcher, async () => (await emitted()).some(file => file !== original), () => writeFile(image, changedImage))
      const updated = await expectLocation('packages/feature/assets')
      expect(updated).not.toBe(original)
      expect(await readFile(path.join(dist, updated))).toEqual(changedImage)
      expect((await files()).includes(original)).toBe(false)

      await waitForAssetBuild(watcher, async () => !(await read(`${feature}.wxss`)).includes('image-'), () => writeFile(source(`${feature}.wxss`), '.page { color: red; }'))
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

it.each([false, true])('refreshes WXML-only dependency images in watch mode: independent=%s', async (independent) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main, feature] = fixture.routes
    const src = path.join(fixture.root, 'src')
    const dist = path.join(fixture.root, 'dist')
    const image = path.join(fixture.root, 'node_modules/fixture-images/logo.svg')
    const imageBytes = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" fill="${color}"/></svg>`
    await mkdir(path.dirname(image))
    await writeFile(image, imageBytes('red'))
    await writeFile(path.join(src, 'app.json'), JSON.stringify({
      pages: [main],
      subPackages: [{ root: 'packages/feature', pages: ['pages/index/index'], independent }],
    }))
    for (const route of fixture.routes) {
      await writeFile(path.join(src, `${route}.js`), 'Page({})')
      await writeFile(path.join(src, `${route}.wxss`), '')
    }
    const featureTemplate = path.join(src, `${feature}.wxml`)
    await writeFile(featureTemplate, '<image src="/node_modules/fixture-images/logo.svg"/>')
    const watcher = await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: { watch: {}, assetsDir: '[subpackage]/assets', assetsInlineLimit: 0 },
    })
    if (!('on' in watcher)) {
      throw new Error('Expected a watch build')
    }
    try {
      const files = async () => (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
      const template = () => readFile(path.join(dist, `${feature}.wxml`), 'utf8')
      const published = async (color: string) => {
        const candidates = (await files()).filter(file => /(?:^|\/)logo-[^/]+\.svg$/.test(file))
        if (candidates.length !== 1) {
          return false
        }
        const [file] = candidates
        return path.dirname(file!) === 'packages/feature/assets'
          && (await readFile(path.join(dist, file!), 'utf8')) === imageBytes(color)
          && (await template()).includes(`src="/${file}"`)
      }
      await waitForAssetBuild(watcher, () => published('red'))
      const original = (await files()).find(file => /(?:^|\/)logo-[^/]+\.svg$/.test(file))
      await waitForAssetBuild(watcher, () => published('blue'), () => writeFile(image, imageBytes('blue')))
      expect(await files()).not.toContain(original)
      await waitForAssetBuild(watcher, async () => (await template()).includes('no-image'), () => writeFile(featureTemplate, '<view>no-image</view>'))
      expect((await files()).filter(file => /(?:^|\/)logo-[^/]+\.svg$/.test(file))).toEqual([])
    }
    finally {
      await watcher.close()
    }
  }
  finally {
    await fixture.close()
  }
}, 30_000)
