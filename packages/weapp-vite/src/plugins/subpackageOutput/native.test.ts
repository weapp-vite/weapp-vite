import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'

it.each([
  { extension: 'js', naming: 'assetsDir' },
  { extension: 'wxss', naming: 'assetsDir' },
  { extension: 'wxml', naming: 'assetsDir' },
  { extension: 'js', naming: 'string' },
  { extension: 'wxss', naming: 'string' },
  { extension: 'wxml', naming: 'string' },
  { extension: 'js', naming: 'callback' },
  { extension: 'wxml', naming: 'function' },
  { extension: 'wxss', naming: 'plain assetsDir' },
] as const)('emits an independent image from $extension only once with $naming naming', async ({ extension, naming }) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [mainRoute, childRoute] = fixture.routes
    const packageRoot = 'packages/feature'
    const source = (file: string) => path.join(fixture.root, 'src', file)
    await writeFile(source('app.json'), JSON.stringify({
      pages: [mainRoute],
      subPackages: [{ root: packageRoot, pages: ['pages/index/index'], independent: true }],
    }))
    await copyFile(source(`${packageRoot}/image.png`), source(`${packageRoot}/runtime.png`))
    for (const route of fixture.routes) {
      await writeFile(source(`${route}.js`), 'Page({})')
      await writeFile(source(`${route}.wxss`), '')
      await writeFile(source(`${route}.wxml`), '<view/>')
    }
    const references = {
      js: 'import image from "../../image.png"; Page({ data: { image } })',
      wxss: '.page { background: url("../../image.png"); }',
      wxml: '<image src="../../image.png"/>',
    }
    await writeFile(source(`${childRoute}.${extension}`), references[extension])
    const template = 'images/[name]-[hash][extname]'
    const assetFileNames = {
      'assetsDir': undefined,
      'plain assetsDir': undefined,
      'string': template,
      'callback': () => template,
      'function': () => `${packageRoot}/${template}`,
    }[naming]
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: {
        assetsDir: naming === 'plain assetsDir' ? 'images' : '[subpackage]/assets',
        assetsInlineLimit: 0,
        rolldownOptions: { output: assetFileNames ? { assetFileNames } : {} },
      },
    })
    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const images = files.filter(file => /(?:^|\/)image(?:-[^/]+)?\.png$/.test(file))
    expect(images).toHaveLength(1)
    expect(path.dirname(images[0]!)).toBe(`${packageRoot}/${naming === 'assetsDir' ? 'assets' : 'images'}`)
    expect(files).toContain(`${packageRoot}/runtime.png`)
    expect(await readFile(path.join(dist, `${childRoute}.${extension}`), 'utf8')).toContain(`/${images[0]}`)
  }
  finally {
    await fixture.close()
  }
})

it('promotes a WXML-only image shared with the main package and keeps one emitted file', async () => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [mainRoute, featureRoute] = fixture.routes
    for (const route of fixture.routes) {
      await writeFile(path.join(fixture.root, 'src', `${route}.js`), 'Page({})')
      await writeFile(path.join(fixture.root, 'src', `${route}.wxss`), '')
      await writeFile(path.join(fixture.root, 'src', `${route}.wxml`), '<image src="/packages/feature/image.png"/>')
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
    expect(images).toEqual([expect.stringMatching(/^assets\/image-/)])
    for (const route of [mainRoute, featureRoute]) {
      expect(await readFile(path.join(dist, `${route}.wxml`), 'utf8')).toContain(`src="/${images[0]}"`)
    }
  }
  finally {
    await fixture.close()
  }
})

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

it.each([
  { name: 'placeholder naming', consumers: 'mixed', usePlaceholder: true, useCallback: false },
  { name: 'explicit string without a placeholder', consumers: 'js', usePlaceholder: false, useCallback: false },
  { name: 'explicit callback without a placeholder', consumers: 'wxss', usePlaceholder: false, useCallback: true },
  { name: 'WXML-only with explicit naming', consumers: 'wxml', usePlaceholder: false, useCallback: false },
] as const)('checks unreachable asset paths with $name', async ({ consumers, usePlaceholder, useCallback }) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [mainRoute] = fixture.routes
    for (const route of fixture.routes) {
      if (consumers === 'js' || consumers === 'wxml') {
        await writeFile(path.join(fixture.root, 'src', `${route}.wxss`), '')
      }
      if (consumers === 'wxss') {
        await writeFile(path.join(fixture.root, 'src', `${route}.js`), 'Page({})')
        await writeFile(path.join(fixture.root, 'src', `${route}.wxml`), '<view class="page"/>')
      }
      if (consumers === 'wxml') {
        await writeFile(path.join(fixture.root, 'src', `${route}.js`), 'Page({})')
        await writeFile(path.join(fixture.root, 'src', `${route}.wxml`), '<image src="/packages/feature/image.png"/>')
      }
    }
    const compile = (directory: string) => build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: {
        ...(usePlaceholder ? { assetsDir: '[subpackage]/assets' } : {}),
        assetsInlineLimit: 0,
        minify: false,
        rolldownOptions: {
          output: {
            assetFileNames: useCallback ? () => `${directory}/[name]-[hash][extname]` : `${directory}/[name]-[hash][extname]`,
          },
        },
      },
    })
    const extension = consumers === 'mixed' ? '(?:js|wxss)' : consumers
    await expect(compile(`${usePlaceholder ? '[subpackage]/' : ''}packages/feature/assets`))
      .rejects
      .toThrow(new RegExp(`跨分包资源 "packages/feature/assets/image-[^/]+\\.png" 无法由 "${mainRoute}\\.${extension}" 访问`))
    await compile('assets')
    const files = (await readdir(path.join(fixture.root, 'dist'), { recursive: true })).map(file => path.normalize(file))
    for (const route of fixture.routes) {
      for (const extension of ['js', 'json', 'wxml', 'wxss']) {
        expect(files).toContain(`${route}.${extension}`)
      }
      if (consumers === 'wxml') {
        const template = await readFile(path.join(fixture.root, 'dist', `${route}.wxml`), 'utf8')
        const target = template.match(/src="\/([^"]+)"/)![1]!
        expect(target).toMatch(/^assets\//)
        expect(files).toContain(target)
      }
      else if (consumers !== 'js') {
        const css = await readFile(path.join(fixture.root, 'dist', `${route}.wxss`), 'utf8')
        const url = css.match(/url\(["']?([^"')]+)["']?\)/)![1]!
        const target = url.startsWith('/') ? url.slice(1) : path.normalize(path.join(path.dirname(route), url))
        expect(target).toMatch(/^assets\//)
        expect(files).toContain(target)
      }
    }
    expect(files.filter(file => file.endsWith('.png'))).toEqual([expect.stringMatching(/^assets\/image-[^/]+\.png$/)])
  }
  finally {
    await fixture.close()
  }
})

it('checks WXML access even when an emitted image name already matches the source path', async () => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main] = fixture.routes
    for (const route of fixture.routes) {
      await writeFile(path.join(fixture.root, 'src', `${route}.wxss`), '')
    }
    await writeFile(path.join(fixture.root, 'src', `${main}.js`), 'Page({})')
    await writeFile(path.join(fixture.root, 'src', `${main}.wxml`), '<image src="/packages/feature/image.png"/>')
    await expect(build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: {
        write: false,
        assetsInlineLimit: 0,
        rolldownOptions: { output: { assetFileNames: 'packages/feature/[name][extname]' } },
      },
    }).then(() => undefined)).rejects.toThrow(`跨分包资源 "packages/feature/image.png" 无法由 "${main}.wxml" 访问`)
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
