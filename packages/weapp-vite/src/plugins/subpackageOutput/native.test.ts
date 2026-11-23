import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'

it.each(['assetsDir', 'assetFileNames (string)', 'assetFileNames (function)'] as const)('uses %s for images referenced only in WXML', async (option) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [mainRoute, featureRoute] = fixture.routes
    for (const route of [mainRoute, featureRoute]) {
      await writeFile(path.join(fixture.root, 'src', `${route}.js`), 'Page({})')
      await writeFile(path.join(fixture.root, 'src', `${route}.wxss`), '')
    }
    await mkdir(path.join(fixture.root, 'public'))
    await writeFile(path.join(fixture.root, 'public/icon.svg'), '<svg/>')
    await writeFile(path.join(fixture.root, 'src/main.svg'), '<svg viewBox="0 0 1 1"/>')
    await writeFile(path.join(fixture.root, 'src', `${mainRoute}.wxml`), '<image src="/main.svg"/>')
    await writeFile(path.join(fixture.root, 'src', `${featureRoute}.wxml`), [
      '<image src="../../image.png?version=1#icon"/>',
      '<image src="/icon.svg"/>',
      '<image src="data:image/svg+xml,%3Csvg/%3E"/>',
      '<image src="//example.test/image.png"/>',
      '<image src="/packages/feature/image.png"/>',
    ].join('\n'))
    const template = '[subpackage]/custom/[name][extname]'
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: option === 'assetsDir'
        ? { assetsDir: '[subpackage]/assets' }
        : { assetsDir: 'ignored', rolldownOptions: { output: { assetFileNames: option.endsWith('(function)') ? () => template : template } } },
    })

    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const emitted = option === 'assetsDir'
      ? files.find(file => /^packages\/feature\/assets\/image-[^/]+\.png$/.test(file))
      : 'packages/feature/custom/image.png'
    expect(emitted).toBeDefined()
    expect(files).toContain(emitted)
    expect(files).not.toContain('packages/feature/image.png')
    const wxml = await readFile(path.join(dist, `${featureRoute}.wxml`), 'utf8')
    expect(wxml).toContain(`src="/${emitted}?version=1#icon"`)
    expect(wxml).toContain(`src="/${emitted}"`)
    expect(wxml).toContain('src="/icon.svg"')
    expect(wxml).toContain('src="data:image/svg+xml,%3Csvg/%3E"')
    expect(wxml).toContain('src="//example.test/image.png"')
    expect(await readFile(path.join(dist, 'icon.svg'), 'utf8')).toBe('<svg/>')
    const mainImage = option === 'assetsDir' ? files.find(file => /^assets\/main-[^/]+\.svg$/.test(file)) : 'custom/main.svg'
    expect(mainImage).toBeDefined()
    expect(files).toContain(mainImage)
    expect(files).not.toContain('main.svg')
    expect(await readFile(path.join(dist, `${mainRoute}.wxml`), 'utf8')).toContain(`src="/${mainImage}"`)
  }
  finally {
    await fixture.close()
  }
})

it('rejects inaccessible physical assets in a native host and preserves public output references', async () => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const compile = (shared: boolean) => build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: {
        assetsDir: '[subpackage]/assets',
        assetsInlineLimit: 0,
        minify: false,
        rolldownOptions: { output: shared ? { assetFileNames: 'assets/[name]-[hash][extname]' } : {} },
      },
    })
    await expect(compile(false)).rejects.toThrow('跨分包资源')
    await compile(true)
    const files = (await readdir(path.join(fixture.root, 'dist'), { recursive: true })).map(file => path.normalize(file))
    for (const route of fixture.routes) {
      for (const extension of ['js', 'json', 'wxml', 'wxss']) {
        expect(files).toContain(`${route}.${extension}`)
      }
      const css = await readFile(path.join(fixture.root, 'dist', `${route}.wxss`), 'utf8')
      const url = css.match(/url\(["']?([^"')]+)["']?\)/)![1]!
      const target = url.startsWith('/') ? url.slice(1) : path.normalize(path.join(path.dirname(route), url))
      expect(target).toMatch(/^assets\//)
      expect(files).toContain(target)
    }
  }
  finally {
    await fixture.close()
  }
})

it('keeps an imported dependency image in each build that consumes it', async () => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [mainRoute, independentRoute] = fixture.routes
    const packageRoot = 'packages/feature'
    await writeFile(path.join(fixture.root, 'src/app.json'), JSON.stringify({
      pages: [mainRoute],
      subPackages: [{ root: packageRoot, pages: ['pages/index/index'], independent: true }],
    }))
    const dependency = path.join(fixture.root, 'node_modules/fixture-images')
    await mkdir(dependency)
    await writeFile(path.join(dependency, 'package.json'), JSON.stringify({ name: 'fixture-images', exports: { './logo.png': './logo.png' } }))
    await copyFile(path.join(fixture.root, 'src', packageRoot, 'image.png'), path.join(dependency, 'logo.png'))
    for (const route of [mainRoute, independentRoute]) {
      await writeFile(path.join(fixture.root, 'src', `${route}.js`), 'import image from "fixture-images/logo.png"; Page({ data: { image } })')
      await writeFile(path.join(fixture.root, 'src', `${route}.wxss`), '.page { background: url("fixture-images/logo.png"); }')
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
    const logos = files.filter(file => /\/logo-[^/]+\.png$/.test(file))
    expect(logos).toHaveLength(2)
    for (const [route, assetsDir] of [[mainRoute, 'assets'], [independentRoute, `${packageRoot}/assets`]] as const) {
      const logo = logos.find(file => path.dirname(file) === assetsDir)
      expect(logo).toBeDefined()
      expect(await readFile(path.join(dist, `${route}.js`), 'utf8')).toContain(`/${logo}`)
      expect(await readFile(path.join(dist, `${route}.wxss`), 'utf8')).toContain(`/${logo}`)
    }
  }
  finally {
    await fixture.close()
  }
})

it.each(['script', 'style'])('keeps native image references valid when a local image is also used by %s', async (kind) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [mainRoute, featureRoute] = fixture.routes
    const source = (route: string, extension: string) => path.join(fixture.root, 'src', `${route}.${extension}`)
    await writeFile(source(mainRoute, 'js'), 'Page({})')
    await writeFile(source(mainRoute, 'wxss'), '')
    if (kind === 'style') {
      await writeFile(source(featureRoute, 'js'), 'Page({})')
    }
    else {
      await writeFile(source(featureRoute, 'wxss'), '')
    }
    await writeFile(source(featureRoute, 'wxml'), [
      '<image src="../../image.png?version=1#icon"/>',
      '<image src="{{image}}"/>',
      '<image src="https://example.test/image.png"/>',
    ].join('\n'))
    await copyFile(path.join(fixture.root, 'src/packages/feature/image.png'), path.join(fixture.root, 'src/packages/feature/copied.png'))
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
    const emitted = files.find(file => /^packages\/feature\/assets\/image-[^/]+\.png$/.test(file))
    expect(emitted).toBeDefined()
    expect(files).not.toContain('packages/feature/image.png')
    expect(files).toContain('packages/feature/copied.png')
    const wxml = await readFile(path.join(dist, `${featureRoute}.wxml`), 'utf8')
    expect(wxml).toContain(`src="/${emitted}?version=1#icon"`)
    expect(wxml).toContain('src="{{image}}"')
    expect(wxml).toContain('src="https://example.test/image.png"')
    if (kind === 'style') {
      expect(await readFile(path.join(dist, `${featureRoute}.wxss`), 'utf8')).toContain(`/${emitted}`)
    }
  }
  finally {
    await fixture.close()
  }
})
