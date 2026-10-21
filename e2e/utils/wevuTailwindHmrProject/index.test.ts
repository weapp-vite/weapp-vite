import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createWevuTailwindHmrProject } from './index'

const workspaces: string[] = []
const dependencyNames = ['weapp-vite', '@scope/config']

async function createWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-tailwind-hmr-project-'))
  workspaces.push(root)
  const template = path.join(root, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template')
  const files = {
    'package.json': JSON.stringify({ dependencies: { 'weapp-vite': '*' }, devDependencies: { '@scope/config': '*' } }),
    'src/pages/index/index.vue': '<template><view class="min-h-screen bg-[#f6f7fb]" /></template>',
    'src/app.vue': '<script setup lang="ts">\n</script>',
    'project.config.json': '{"appid":"real-test-app-id"}',
    'project.private.config.json': '{"condition":{"miniprogram":{"list":[]}}}',
    'weapp-vite.config.ts': 'export default defineConfig({ weapp: {} })',
    'dist/app.js': 'template-output',
    '.cache/marker': 'template-cache',
    'node_modules/marker': 'template-node-modules',
  }
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(template, relative)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, content)
  }
  for (const name of dependencyNames) {
    const installed = path.join(root, 'store', name)
    const target = path.join(template, 'node_modules', name)
    await mkdir(installed, { recursive: true })
    await writeFile(path.join(installed, 'package.json'), JSON.stringify({ name }))
    await mkdir(path.dirname(target), { recursive: true })
    await symlink(await realpath(installed), target, 'junction')
  }
  const unknown = path.join(root, '.tmp/e2e/ide-wevu-tailwind-hmr/other-project')
  await mkdir(unknown, { recursive: true })
  await writeFile(path.join(unknown, 'marker'), 'other-owner')
  return { root, template, unknown }
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('isolated Wevu Tailwind HMR project dependencies', () => {
  it('owns node_modules and links every declared dependency directly to its real directory', async () => {
    const { root, template, unknown } = await createWorkspace()
    const project = await createWevuTailwindHmrProject(root)
    const modules = await lstat(path.join(project.project, 'node_modules'))
    expect(modules.isDirectory()).toBe(true)
    expect(modules.isSymbolicLink()).toBe(false)
    for (const name of dependencyNames) {
      expect(await realpath(path.join(project.project, 'node_modules', name)))
        .toBe(await realpath(path.join(root, 'store', name)))
    }
    expect(await readFile(path.join(project.project, 'project.config.json'), 'utf8'))
      .toBe(await readFile(path.join(template, 'project.config.json'), 'utf8'))
    expect(await readFile(path.join(project.project, 'project.private.config.json'), 'utf8'))
      .toBe(await readFile(path.join(template, 'project.private.config.json'), 'utf8'))
    for (const relative of ['dist', '.cache', 'node_modules/marker']) {
      await expect(lstat(path.join(project.project, relative))).rejects.toMatchObject({ code: 'ENOENT' })
    }
    // 依赖目录可由构建器继续创建其缓存，而不经过两层 junction。
    await mkdir(path.join(project.project, 'node_modules/weapp-vite/.cache'), { recursive: true })
    await Promise.all([project.cleanup(), project.cleanup()])
    await project.cleanup()
    await expect(lstat(project.project)).rejects.toMatchObject({ code: 'ENOENT' })
    for (const name of dependencyNames) {
      expect(JSON.parse(await readFile(path.join(root, 'store', name, 'package.json'), 'utf8'))).toEqual({ name })
    }
    expect(await readFile(path.join(template, 'node_modules/marker'), 'utf8')).toBe('template-node-modules')
    expect(await readFile(path.join(template, 'dist/app.js'), 'utf8')).toBe('template-output')
    expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('other-owner')
  })

  it.each(['directory', 'link'])('preserves an unknown %s replacing its owned project', async (replacement) => {
    const { root, unknown } = await createWorkspace()
    const project = await createWevuTailwindHmrProject(root)
    const moved = `${project.project}-moved`
    await rename(project.project, moved)
    if (replacement === 'link') {
      await symlink(await realpath(unknown), project.project, 'junction')
    }
    else {
      await mkdir(project.project)
      await writeFile(path.join(project.project, 'marker'), 'replacement-owner')
    }
    await project.cleanup()
    await project.cleanup()
    expect(await readFile(path.join(project.project, 'marker'), 'utf8'))
      .toBe(replacement === 'link' ? 'other-owner' : 'replacement-owner')
    expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('other-owner')
    expect(await readFile(path.join(moved, 'package.json'), 'utf8')).toContain('weapp-vite')
  })

  it('removes only its partial project when a declared dependency is missing', async () => {
    const { root, template, unknown } = await createWorkspace()
    await rm(path.join(template, 'node_modules/@scope/config'))
    await expect(createWevuTailwindHmrProject(root)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readdir(path.dirname(unknown))).toEqual(['other-project'])
    expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('other-owner')
    expect(await readFile(path.join(root, 'store/@scope/config/package.json'), 'utf8')).toContain('@scope/config')
  })
})
