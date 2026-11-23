import { readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'

it.each([
  ['image', 'src="../../packages/feature/image.png"'],
  ['img', 'src="../../packages/feature/image.png"'],
  ['image', ':src="photo"'],
] as const)('shares a Vue <%s %s> image with a native subpackage stylesheet', async (element, attribute) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main, feature] = fixture.routes
    const source = (file: string) => path.join(fixture.root, 'src', file)
    await symlink(path.resolve(import.meta.dirname, '../../../node_modules/wevu'), path.join(fixture.root, 'node_modules/wevu'), 'junction')
    await writeFile(path.join(fixture.root, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { wevu: '*' } }))
    await rm(source(`${main}.js`))
    await rm(source(`${main}.wxml`))
    await writeFile(source(`${main}.wxss`), '')
    const dynamic = attribute.startsWith(':')
    const template = `<template><view><${element} ${attribute}/></view></template>`
    const script = dynamic ? '<script setup>import photo from "@/packages/feature/image.png"</script>' : ''
    await writeFile(source(`${main}.vue`), `${template}${script}`)
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: { assetsDir: '[subpackage]/assets', assetsInlineLimit: 0, minify: false },
    })
    const dist = path.join(fixture.root, 'dist')
    const assets = (await readdir(dist, { recursive: true })).map(file => path.normalize(file)).filter(file => /(?:^|\/)image(?:-[^/]+)?\.png$/.test(file))
    expect(assets).toEqual([expect.stringMatching(/^assets\/image-[^/]+\.png$/)])
    const templateOutput = await readFile(path.join(dist, `${main}.wxml`), 'utf8')
    if (dynamic) {
      expect(templateOutput).toMatch(/src="\{\{[^}]+\}\}"/)
      const files = (await readdir(dist, { recursive: true })).filter(file => file.endsWith('.js'))
      const scripts = await Promise.all(files.map(file => readFile(path.join(dist, file), 'utf8')))
      expect(scripts.some(code => code.includes(`/${assets[0]}`))).toBe(true)
    }
    else {
      expect(templateOutput).toContain(`src="/${assets[0]}"`)
    }
    expect(await readFile(path.join(dist, `${feature}.wxss`), 'utf8')).toContain(`/${assets[0]}`)
  }
  finally {
    await fixture.close()
  }
})
