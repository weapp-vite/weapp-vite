import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/fs'
import { afterEach, describe, expect, it } from 'vitest'
import { buildQuickApp, serveQuickApp } from './build'

const tempDirectories: string[] = []

async function createProject() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-quickapp-'))
  tempDirectories.push(cwd)
  await fs.ensureDir(path.join(cwd, 'src/pages/home'))
  await fs.ensureDir(path.join(cwd, 'test/pages/home'))
  await writeFile(path.join(cwd, 'src/manifest.json'), JSON.stringify({
    package: 'org.weappvite.test',
    name: 'quickapp-test',
    versionName: '1.0.0',
    versionCode: 1,
    minPlatformVersion: 1070,
    router: {
      entry: 'pages/home',
      pages: {
        'pages/home': { component: 'index' },
      },
    },
  }))
  await writeFile(path.join(cwd, 'src/app.ux'), '<script>export default {}</script>')
  await writeFile(path.join(cwd, 'src/pages/home/index.ux'), '<template><text>native</text></template>')
  await writeFile(path.join(cwd, 'src/shared.js'), 'export const value = 1')
  await writeFile(path.join(cwd, 'test/pages/home/index.js'), 'export default function () {}')
  await writeFile(path.join(cwd, 'weapp-vite.config.mjs'), `export default {
    quickapp: {
      outDir: 'output',
      toolkit: { enabled: false }
    }
  }`)
  return cwd
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(directory => fs.remove(directory)))
})

describe('quickapp build backend', () => {
  it('emits a native QuickApp project and mirrored E2E tests through Vite', async () => {
    const cwd = await createProject()
    const result = await buildQuickApp({ cwd })

    expect(result.rpkFiles).toEqual([])
    await expect(readFile(path.join(cwd, 'output/src/app.ux'), 'utf8')).resolves.toContain('export default')
    await expect(readFile(path.join(cwd, 'output/src/pages/home/index.ux'), 'utf8')).resolves.toContain('native')
    await expect(readFile(path.join(cwd, 'output/src/shared.js'), 'utf8')).resolves.toContain('value = 1')
    await expect(readFile(path.join(cwd, 'output/test/pages/home/index.js'), 'utf8')).resolves.toContain('export default')
    await expect(readFile(path.join(cwd, 'output/package.json'), 'utf8')).resolves.toContain('weapp-vite-quickapp-output')
  })

  it('rejects mini-program app.json conversion', async () => {
    const cwd = await createProject()
    await writeFile(path.join(cwd, 'src/app.json'), '{}')

    await expect(buildQuickApp({ cwd })).rejects.toThrow('不支持把微信小程序 app.json 转换为 manifest.json')
  })

  it('emits Vue SFC files with the matching .ux extension and runtime', async () => {
    const cwd = await createProject()
    await fs.ensureDir(path.join(cwd, 'src/pages/vue'))
    await writeFile(path.join(cwd, 'src/pages/vue/index.vue'), `
<template><text @click="increment">{{ count }}</text></template>
<script setup>
import { ref } from 'vue'
const count = ref(1)
function increment() { count.value += 1 }
</script>
`)

    await buildQuickApp({ cwd })

    await expect(readFile(path.join(cwd, 'output/src/pages/vue/index.ux'), 'utf8')).resolves.toContain('onclick="increment"')
    await expect(readFile(path.join(cwd, 'output/src/Common/weapp-vite-vue.js'), 'utf8')).resolves.toContain('defineComponent')
    await expect(fs.pathExists(path.join(cwd, 'output/src/pages/vue/indexux'))).resolves.toBe(false)
  })

  it.each(['wxml', 'wxss', 'wxs'])('rejects mini-program .%s source files', async (extension) => {
    const cwd = await createProject()
    await writeFile(path.join(cwd, `src/pages/home/legacy.${extension}`), '')

    await expect(buildQuickApp({ cwd })).rejects.toThrow('不支持转换小程序模板或样式')
  })

  it.each([
    ['usingComponents', 'src/pages/home/index.json', JSON.stringify({ usingComponents: { card: '/components/card' } })],
    ['wx.*', 'src/shared.ts', 'export const request = () => wx.request({ url: \'/api\' })'],
    ['Page()', 'src/shared.js', 'Page({})'],
    ['setData()', 'src/pages/home/index.ux', '<script>export default { update() { this.setData({ value: 1 }) } }</script>'],
  ])('rejects mini-program runtime contract %s', async (marker, relativePath, source) => {
    const cwd = await createProject()
    const filePath = path.join(cwd, relativePath)
    await fs.ensureDir(path.dirname(filePath))
    await writeFile(filePath, source)

    await expect(buildQuickApp({ cwd })).rejects.toThrow(marker)
  })

  it('requires a native app.ux entry instead of claiming app.vue application support', async () => {
    const cwd = await createProject()
    await fs.remove(path.join(cwd, 'src/app.ux'))
    await writeFile(path.join(cwd, 'src/app.vue'), '<script setup>const ready = true</script>')

    await expect(buildQuickApp({ cwd })).rejects.toThrow('必须提供原生 src/app.ux')
  })

  it('regenerates the QuickApp project in watch mode', async () => {
    const cwd = await createProject()
    const sourceFile = path.join(cwd, 'src/pages/home/index.ux')
    const outputFile = path.join(cwd, 'output/src/pages/home/index.ux')
    const session = await serveQuickApp({ cwd })

    try {
      await writeFile(sourceFile, '<template><text>updated</text></template>')
      await expect.poll(async () => {
        return fs.pathExists(outputFile) ? readFile(outputFile, 'utf8') : ''
      }, { timeout: 5_000 }).toContain('updated')
    }
    finally {
      await session.close()
    }
  })
})
