import { Buffer } from 'node:buffer'
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture, readPageImage } from './nativeFixture'

it.each([
  { name: 'only by subpackage JS', via: 'js', location: 'subpackage' },
  { name: 'only by subpackage JS with plain assetsDir', via: 'js', location: 'subpackage', plainAssetsDir: true },
  { name: 'only by subpackage WXSS', via: 'wxss', location: 'subpackage' },
  { name: 'only by subpackage WXSS with plain assetsDir', via: 'wxss', location: 'subpackage', plainAssetsDir: true },
  { name: 'only by subpackage WXML', via: 'wxml', location: 'subpackage' },
  { name: 'only by subpackage WXML with plain assetsDir', via: 'wxml', location: 'subpackage', plainAssetsDir: true },
  { name: 'only by independent subpackage WXML', via: 'wxml', location: 'subpackage', independent: true },
  { name: 'only by independent subpackage WXML with plain assetsDir', via: 'wxml', location: 'subpackage', independent: true, plainAssetsDir: true },
  { name: 'from main WXML and subpackage JS', via: 'js', location: 'main', mainTemplate: true },
  { name: 'from main JS and subpackage JS', via: 'js', location: 'main', mainLogo: 'logo.png' },
  { name: 'from main JS and subpackage JS with plain assetsDir', via: 'js', location: 'main', mainLogo: 'logo.png', plainAssetsDir: true },
  { name: 'from main JS and subpackage WXSS', via: 'wxss', location: 'main', mainLogo: 'logo.png' },
  { name: 'under separate paths with identical bytes', via: 'wxss', location: 'main', mainLogo: 'other/logo.png' },
  { name: 'with a Rolldown naming callback', via: 'js', location: 'subpackage', customNaming: true },
] as const)('places dependency images used $name', async ({ via, location, ...options }) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [mainRoute, featureRoute] = fixture.routes
    const source = (route: string, ext: string) => path.join(fixture.root, 'src', `${route}.${ext}`)
    const dependency = path.join(fixture.root, 'node_modules/fixture-images')
    const outsideURL = path.relative(path.dirname(source(featureRoute, 'wxml')), path.join(fixture.root, 'outside.png'))
    if ('independent' in options) {
      await writeFile(path.join(fixture.root, 'src/app.json'), JSON.stringify({
        pages: [mainRoute],
        subPackages: [{ root: 'packages/feature', pages: ['pages/index/index'], independent: true }],
      }))
    }
    await mkdir(dependency)
    const image = path.join(fixture.root, 'src/packages/feature/image.png')
    await mkdir(path.join(dependency, 'other'))
    await writeFile(path.join(dependency, 'package.json'), JSON.stringify({ name: 'fixture-images', exports: { './*': './*' } }))
    await copyFile(image, path.join(dependency, 'logo.png'))
    await copyFile(image, path.join(dependency, 'other/logo.png'))
    for (const route of [mainRoute, featureRoute]) {
      await writeFile(source(route, 'js'), 'Page({})')
      await writeFile(source(route, 'wxss'), '')
    }
    const featureSource = {
      js: 'import image from "fixture-images/logo.png"; Page({ data: { image } })',
      wxss: '.page { background: url("fixture-images/logo.png"); }',
      wxml: `<image src="/node_modules/fixture-images/logo.png"/><image src="${outsideURL}"/>`,
    }
    if (via === 'wxml') {
      await copyFile(image, path.join(fixture.root, 'outside.png'))
    }
    await writeFile(source(featureRoute, via), featureSource[via])
    if ('mainTemplate' in options) {
      await writeFile(source(mainRoute, 'wxml'), '<image src="../../../node_modules/fixture-images/logo.png"/>')
    }
    if ('mainLogo' in options) {
      await writeFile(source(mainRoute, 'js'), `import image from "fixture-images/${options.mainLogo}"; Page({ data: { image } })`)
    }
    const customNaming = 'customNaming' in options
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: {
        assetsDir: customNaming ? 'fallback' : 'plainAssetsDir' in options ? 'assets' : '[subpackage]/assets',
        assetsInlineLimit: 0,
        minify: false,
        manifest: true,
        rolldownOptions: customNaming
          ? { output: { assetFileNames: () => '[subpackage]/managed/[name]-[hash][extname]' } }
          : undefined,
      },
    })
    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const logos = files.filter(file => /\/logo-[^/]+\.png$/.test(file))
    const directory = `${location === 'subpackage' ? 'packages/feature/' : ''}${customNaming ? 'managed' : 'assets'}`
    expect(logos).toEqual([expect.stringMatching(`^${directory}/logo-`)])
    expect(await readFile(path.join(dist, logos[0]!))).toEqual(await readFile(image))
    const featureOutput = await readFile(path.join(dist, `${featureRoute}.${via}`), 'utf8')
    if (via === 'js') {
      expect(readPageImage(dist, featureRoute)).toBe(`/${logos[0]}`)
    }
    else {
      expect(featureOutput).toContain(`/${logos[0]}`)
    }
    if (via === 'wxml') {
      expect(featureOutput).toContain(`src="${outsideURL}"`)
      expect(files.some(file => /(?:^|\/)outside(?:-|\.)/.test(file))).toBe(false)
    }
    const manifest = JSON.parse(await readFile(path.join(dist, '.vite/manifest.json'), 'utf8')) as Record<string, {
      file: string
      assets?: string[]
    }>
    const referencedFiles = Object.values(manifest).flatMap(item => [item.file, ...item.assets ?? []])
    if (via !== 'wxml') {
      expect(referencedFiles).toContain(logos[0])
    }
    expect(JSON.stringify(manifest)).not.toContain('weapp-vite-asset-references')
    expect(files.some(file => file.startsWith('weapp-vite-asset-references'))).toBe(false)
    if ('mainLogo' in options) {
      expect(readPageImage(dist, mainRoute)).toBe(`/${logos[0]}`)
    }
    if ('mainTemplate' in options) {
      expect(await readFile(path.join(dist, `${mainRoute}.wxml`), 'utf8')).toContain(`src="/${logos[0]}"`)
    }
  }
  finally {
    await fixture.close()
  }
})

it.each([false, true])('places dependency images used by a native subpackage component: shared=%s', async (shared) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main, feature] = fixture.routes
    const component = 'packages/feature/components/brand/index'
    const source = (entry: string, ext: string) => path.join(fixture.root, 'src', `${entry}.${ext}`)
    const dependency = path.join(fixture.root, 'node_modules/fixture-images')
    const bytes = await readFile(path.join(fixture.root, 'src/packages/feature/image.png'))
    await mkdir(dependency)
    await writeFile(path.join(dependency, 'package.json'), JSON.stringify({ name: 'fixture-images', exports: { './logo.png': './logo.png' } }))
    await writeFile(path.join(dependency, 'logo.png'), bytes)
    for (const route of fixture.routes) {
      await writeFile(source(route, 'js'), 'Page({})')
      await writeFile(source(route, 'wxss'), '')
    }
    await writeFile(source(main, 'wxml'), shared ? '<image src="/node_modules/fixture-images/logo.png"/>' : '<view/>')
    await writeFile(source(feature, 'wxml'), '<brand/>')
    await writeFile(source(feature, 'json'), JSON.stringify({ usingComponents: { brand: '/packages/feature/components/brand/index' } }))
    await mkdir(path.dirname(source(component, 'js')), { recursive: true })
    await writeFile(source(component, 'js'), 'import image from "fixture-images/logo.png"; Component({ data: { image } })')
    await writeFile(source(component, 'json'), JSON.stringify({ component: true }))
    await writeFile(source(component, 'wxml'), '<image src="{{image}}"/>')
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: { assetsDir: 'assets', assetsInlineLimit: 0 },
    })
    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const logos = files.filter(file => /(?:^|\/)logo-[^/]+\.png$/.test(file))
    expect(logos).toHaveLength(1)
    const [logo] = logos
    expect(path.dirname(logo!)).toBe(shared ? 'assets' : 'packages/feature/assets')
    expect(await readFile(path.join(dist, logo!))).toEqual(bytes)
    expect(readPageImage(dist, component)).toBe(`/${logo}`)
    expect(JSON.parse(await readFile(path.join(dist, `${feature}.json`), 'utf8')) as unknown)
      .toMatchObject({ usingComponents: { brand: '/packages/feature/components/brand/index' } })
    if (shared) {
      expect(await readFile(path.join(dist, `${main}.wxml`), 'utf8')).toContain(`src="/${logo}"`)
    }
  }
  finally {
    await fixture.close()
  }
})

it('moves the dependency image bytes out of the main package when the subpackage is the only consumer', async () => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main, feature] = fixture.routes
    const subpackage = 'packages/feature'
    const source = (file: string) => path.join(fixture.root, 'src', file)
    const dist = path.join(fixture.root, 'dist')
    const dependency = path.join(fixture.root, 'node_modules/fixture-images')
    const image = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><desc>${'fixture image description '.repeat(4096)}</desc><rect width="100" height="100"/></svg>`
    const imageBytes = Buffer.byteLength(image)
    await mkdir(dependency)
    await writeFile(path.join(dependency, 'package.json'), JSON.stringify({ name: 'fixture-images', exports: { './logo.svg': './logo.svg' } }))
    await writeFile(path.join(dependency, 'logo.svg'), image)
    await writeFile(source(`${main}.js`), 'Page({})')
    await writeFile(source(`${main}.wxss`), '')
    await writeFile(source(`${feature}.js`), 'import logo from "fixture-images/logo.svg"; Page({ data: { image: logo } })')
    await writeFile(source(`${feature}.wxss`), '')
    const measure = async (expectedDirectory: string, publicOutput = false) => {
      await build({
        root: fixture.root,
        configFile: false,
        logLevel: 'silent',
        plugins: [weapp()],
        weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
        build: {
          assetsDir: 'assets',
          assetsInlineLimit: 0,
          emptyOutDir: true,
          ...(publicOutput && { rolldownOptions: { output: { assetFileNames: 'assets/[name]-[hash][extname]' } } }),
        },
      })
      const entries = await readdir(dist, { recursive: true, withFileTypes: true })
      const files = entries.filter(entry => entry.isFile())
      const logo = files.filter(entry => /^logo-[^/]+\.svg$/.test(entry.name))
      expect(logo).toHaveLength(1)
      const logoFile = path.join(logo[0]!.parentPath, logo[0]!.name)
      expect(path.dirname(path.relative(dist, logoFile))).toBe(expectedDirectory)
      expect(await readFile(logoFile, 'utf8')).toBe(image)
      expect(await readFile(path.join(dist, `${feature}.js`), 'utf8')).toContain(`/${path.relative(dist, logoFile)}`)
      const sizes = await Promise.all(files.map(async ({ name, parentPath }) => {
        const absolute = path.join(parentPath, name)
        return { relative: path.relative(dist, absolute), bytes: (await stat(absolute)).size }
      }))
      return sizes.reduce((bytes, file) => {
        if (file.relative.startsWith(`${subpackage}/`)) {
          bytes.feature += file.bytes
        }
        else {
          bytes.main += file.bytes
        }
        return bytes
      }, { main: 0, feature: 0 })
    }
    const ordinary = await measure('assets', true)
    const owned = await measure(`${subpackage}/assets`)
    expect(ordinary.main - owned.main).toBeGreaterThanOrEqual(imageBytes - 1024)
    expect(owned.feature - ordinary.feature).toBeGreaterThanOrEqual(imageBytes)
  }
  finally {
    await fixture.close()
  }
})
