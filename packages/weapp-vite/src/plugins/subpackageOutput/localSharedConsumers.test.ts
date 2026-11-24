import { copyFile, mkdir, readdir, readFile, symlink, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture, readPageImage } from './nativeFixture'

it('names exclusive main and subpackage images in separate configured directories', async () => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main, feature] = fixture.routes
    const src = path.join(fixture.root, 'src')
    await writeFile(path.join(src, 'main.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')
    await writeFile(path.join(src, `${main}.js`), 'import image from "../../main.svg"; Page({ data: { image } })')
    await writeFile(path.join(src, `${main}.wxss`), '.page { background: url("../../main.svg") }')
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: { assetsDir: '[subpackage]/managed', assetsInlineLimit: 0 },
    })
    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const images = files.filter(file => /\.(?:png|svg)$/.test(file))
    expect(images).toHaveLength(2)
    for (const [route, expectedPath] of [[main, /^managed\/main-[^/]+\.svg$/], [feature, /^packages\/feature\/managed\/image-[^/]+\.png$/]] as const) {
      const file = images.find(file => expectedPath.test(file))
      expect(file).toBeDefined()
      expect(readPageImage(dist, route)).toBe(`/${file}`)
      expect(await readFile(path.join(dist, `${route}.wxss`), 'utf8')).toContain(`/${file}`)
    }
  }
  finally {
    await fixture.close()
  }
})

it.each([
  { name: 'main JS and subpackage JS/WXSS', mainConsumer: 'js' },
  { name: 'main WXML and subpackage JS/WXSS', mainConsumer: 'wxml' },
  { name: 'only main JS', mainConsumer: 'js', mainOnly: true },
  { name: 'two ordinary subpackages', mainConsumer: 'js', anotherSubpackage: true },
] as const)('emits one main-package image for $name', async ({ mainConsumer, ...options }) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [mainRoute, featureRoute] = fixture.routes
    const source = (route: string, ext: string) => path.join(fixture.root, 'src', `${route}.${ext}`)
    const secondRoute = 'packages/another/detail/index'
    if ('anotherSubpackage' in options) {
      await writeFile(path.join(fixture.root, 'src/app.json'), JSON.stringify({
        pages: [mainRoute],
        subPackages: [
          { root: 'packages/feature', pages: ['pages/index/index'] },
          { root: 'packages/another', pages: ['detail/index'] },
        ],
      }))
      await writeFile(path.join(fixture.root, 'project.private.config.json'), JSON.stringify({ condition: { miniprogram: {
        list: [...fixture.routes, secondRoute].map(route => ({ name: route, pathName: route, query: '' })),
      } } }))
      await mkdir(path.dirname(source(secondRoute, 'js')), { recursive: true })
      await writeFile(source(secondRoute, 'js'), 'import image from "../../feature/image.png"; Page({ data: { image } })')
      await writeFile(source(secondRoute, 'json'), '{}')
      await writeFile(source(secondRoute, 'wxml'), '<image src="{{image}}"/>')
      await writeFile(source(mainRoute, 'js'), 'Page({})')
      await writeFile(source(mainRoute, 'wxml'), '<view/>')
    }
    if ('mainOnly' in options) {
      await writeFile(source(featureRoute, 'js'), 'Page({})')
      await writeFile(source(featureRoute, 'wxss'), '')
      await writeFile(source(featureRoute, 'wxml'), '<view/>')
    }
    await writeFile(source(mainRoute, 'wxss'), '')
    if (mainConsumer === 'wxml') {
      await writeFile(source(mainRoute, 'js'), 'Page({})')
      await writeFile(source(mainRoute, 'wxml'), '<image src="../../packages/feature/image.png"/>')
    }
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: { assetsDir: '[subpackage]/assets', assetsInlineLimit: 0, minify: false },
    })
    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const images = files.filter(file => /(?:^|\/)image(?:-[^/]+)?\.png$/.test(file))
    expect(images).toEqual([expect.stringMatching(/^assets\/image-[^/]+\.png$/)])
    if ('anotherSubpackage' in options) {
      expect(readPageImage(dist, secondRoute)).toBe(`/${images[0]}`)
    }
    else if (mainConsumer === 'js') {
      expect(readPageImage(dist, mainRoute)).toBe(`/${images[0]}`)
    }
    else {
      expect(await readFile(path.join(dist, `${mainRoute}.wxml`), 'utf8')).toContain(`src="/${images[0]}"`)
    }
    if (!('mainOnly' in options)) {
      expect(readPageImage(dist, featureRoute)).toBe(`/${images[0]}`)
      expect(await readFile(path.join(dist, `${featureRoute}.wxss`), 'utf8')).toContain(`/${images[0]}`)
    }
  }
  finally {
    await fixture.close()
  }
})

it.each(['wxml', 'mixed'] as const)('promotes identical images at different paths with %s consumers', async (kind) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main, feature] = fixture.routes
    const source = (file: string) => path.join(fixture.root, 'src', file)
    await copyFile(source('packages/feature/image.png'), source('image.png'))
    for (const [route, src] of [[main, '/image.png'], [feature, '../../image.png']] as const) {
      await writeFile(source(`${route}.js`), 'Page({})')
      const style = route === feature && kind === 'mixed'
      await writeFile(source(`${route}.wxss`), style ? `.page { background: url("${src}"); }` : '')
      await writeFile(source(`${route}.wxml`), style ? '<view class="page"/>' : `<image src="${src}"/>`)
    }
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: { assetsDir: '[subpackage]/assets', assetsInlineLimit: 0 },
    })
    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const images = files.filter(file => /(?:^|\/)image(?:-[^/]+)?\.png$/.test(file))
    expect(images).toEqual([expect.stringMatching(/^assets\/image-[^/]+\.png$/)])
    for (const route of fixture.routes) {
      const style = route === feature && kind === 'mixed'
      expect(await readFile(path.join(dist, `${route}.${style ? 'wxss' : 'wxml'}`), 'utf8')).toContain(`/${images[0]}`)
    }
  }
  finally {
    await fixture.close()
  }
})

it.each([
  { preserveSymlinks: false, consumers: 'mixed' },
  { preserveSymlinks: true, consumers: 'mixed' },
  { preserveSymlinks: false, consumers: 'shared JS across packages' },
  { preserveSymlinks: true, consumers: 'shared JS inside one package' },
  { preserveSymlinks: true, consumers: 'shared JS inside an independent package' },
] as const)('shares a linked image with $consumers and preserveSymlinks=$preserveSymlinks', async ({ preserveSymlinks, consumers }) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const source = (name: string) => path.join(fixture.root, 'src', name)
    const [main, feature] = fixture.routes
    const independent = consumers === 'shared JS inside an independent package'
    const localOnly = independent || consumers === 'shared JS inside one package'
    const mixed = consumers === 'mixed'
    let imageRoutes = fixture.routes
    if (localOnly) {
      const second = 'packages/feature/pages/detail/index'
      imageRoutes = [feature, second]
      await mkdir(path.dirname(source(second)), { recursive: true })
      await writeFile(source(`${second}.json`), '{}')
      await writeFile(source('app.json'), JSON.stringify({
        pages: [main],
        subPackages: [{ root: 'packages/feature', pages: ['pages/index/index', 'pages/detail/index'], independent }],
      }))
      await writeFile(path.join(fixture.root, 'project.private.config.json'), JSON.stringify({ condition: { miniprogram: {
        list: [main, ...imageRoutes].map(route => ({ name: route, pathName: route, query: '' })),
      } } }))
      await writeFile(source(`${main}.js`), 'Page({})')
      await writeFile(source(`${main}.wxml`), '<view/>')
    }
    const physical = source('packages/feature')
    const linked = source('linked-assets')
    await symlink(physical, linked, 'junction')
    const shared = source('common/image.js')
    await mkdir(path.dirname(shared))
    await writeFile(shared, 'import image from "@linked-assets/image.png"; export const getImage = () => image')
    for (const route of imageRoutes) {
      await writeFile(source(`${route}.js`), 'import { getImage } from "@asset-reader"; Page({ data: { image: getImage() } })')
      await writeFile(source(`${route}.wxml`), mixed
        ? `<image src="/${route === main ? 'linked-assets' : 'packages/feature'}/image.png"/>`
        : '<image src="{{image}}"/>')
    }
    await writeFile(source(`${main}.wxss`), '')
    await writeFile(source(`${feature}.wxss`), mixed ? '.page { background-image: url("@physical-assets/image.png"); }' : '')
    const result = await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      resolve: {
        preserveSymlinks,
        alias: {
          '@linked-assets': linked,
          '@physical-assets': physical,
          '@asset-reader': shared,
        },
      },
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: {
        assetsDir: '[subpackage]/assets',
        assetsInlineLimit: 0,
        minify: false,
        ...(localOnly && !independent ? { rolldownOptions: { output: { chunkFileNames: 'chunks/[name]-[hash].js' } } } : {}),
      },
    })
    const outputs = Array.isArray(result) ? result : [result]
    const chunks = outputs.flatMap(output => 'output' in output ? output.output : []).filter(output => output.type === 'chunk')
    if (!independent) {
      const sharedChunk = chunks.find(chunk => Object.keys(chunk.modules).some(module => path.normalize(module) === shared))
      expect(sharedChunk).toBeDefined()
      expect(sharedChunk?.isEntry).toBe(false)
      if (localOnly) {
        expect(sharedChunk?.fileName).toMatch(/^chunks\//)
      }
      for (const route of imageRoutes) {
        expect(chunks.find(chunk => chunk.fileName === `${route}.js`)?.imports).toContain(sharedChunk?.fileName)
      }
    }
    const dist = path.join(fixture.root, 'dist')
    const images = (await readdir(dist, { recursive: true })).map(file => path.normalize(file)).filter(file => file.endsWith('.png'))
    expect(images).toHaveLength(1)
    expect(path.dirname(images[0]!)).toBe(localOnly ? 'packages/feature/assets' : 'assets')
    expect(path.basename(images[0]!)).toMatch(/^image-[^/]+\.png$/)
    expect(await readFile(path.join(dist, images[0]!))).toEqual(await readFile(path.join(physical, 'image.png')))
    for (const route of imageRoutes) {
      expect(readPageImage(dist, route)).toBe(`/${images[0]}`)
      expect(await readFile(path.join(dist, `${route}.wxml`), 'utf8')).toContain(mixed ? `src="/${images[0]}"` : 'src="{{image}}"')
    }
    if (mixed) {
      expect(await readFile(path.join(dist, `${feature}.wxss`), 'utf8')).toContain(`/${images[0]}`)
    }
  }
  finally {
    await fixture.close()
  }
})
