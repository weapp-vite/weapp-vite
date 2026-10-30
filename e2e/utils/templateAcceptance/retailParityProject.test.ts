import fs, { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRetailParityProject } from './retailParityProject'

const workspaces: string[] = []
const dependencyNames = ['weapp-vite', '@scope/config']

async function createWorkspace() {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'retail-parity-project-'))
  workspaces.push(workspace)
  const source = path.join(workspace, 'template')
  const parentDirectory = path.join(workspace, 'projects')
  const files = {
    'package.json': '{\n  "dependencies": {"weapp-vite": "workspace:*"},\n  "devDependencies": {"@scope/config": "1.0.0"}\n}\n',
    'project.config.json': '{\r\n  "libVersion": "3.15.0",\r\n  "setting": {}\r\n}',
    'project.private.config.json': '{"condition":{"miniprogram":{"list":[]}}}\n',
    'weapp-vite.config.ts': 'export default { weapp: { srcRoot: "src" } }\n',
    'src/app.vue': '<template><view>retail source</view></template>\n',
    'public/asset.txt': 'retail asset',
    'dist/app.js': 'source-build-output',
    '.weapp-vite/tsconfig.app.json': '{}',
    '.tmp/marker': 'source-temporary',
    '.cache/marker': 'source-cache',
    '.turbo/marker': 'source-task-cache',
    'src/.cache/marker': 'nested-cache',
    'node_modules/marker': 'source-node-modules',
  }
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(source, relative)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, content)
  }
  const installed = new Map<string, string>()
  for (const name of dependencyNames) {
    const dependency = path.join(workspace, 'store', name)
    await mkdir(dependency, { recursive: true })
    await writeFile(path.join(dependency, 'package.json'), JSON.stringify({ name }))
    const linked = path.join(source, 'node_modules', name)
    await mkdir(path.dirname(linked), { recursive: true })
    await symlink(await realpath(dependency), linked, 'junction')
    installed.set(name, dependency)
  }
  const unknown = path.join(parentDirectory, 'other-project')
  await mkdir(unknown, { recursive: true })
  await writeFile(path.join(unknown, 'marker'), 'other-owner')
  return { source, parentDirectory, files, installed, unknown }
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map(workspace => rm(workspace, { recursive: true, force: true })))
})

describe('isolated retail parity project', () => {
  it('preserves source bytes and dependencies while isolating launch config and build changes', async () => {
    const { source, parentDirectory, files, installed, unknown } = await createWorkspace()
    const project = await createRetailParityProject(source, { parentDirectory })
    const copied = ['package.json', 'project.config.json', 'project.private.config.json', 'weapp-vite.config.ts', 'src/app.vue', 'public/asset.txt']
    for (const relative of copied) {
      expect(await readFile(path.join(project.projectRoot, relative))).toEqual(await readFile(path.join(source, relative)))
    }
    const modules = await lstat(path.join(project.projectRoot, 'node_modules'))
    expect(modules.isDirectory()).toBe(true)
    expect(modules.isSymbolicLink()).toBe(false)
    for (const [name, dependency] of installed) {
      expect(await realpath(path.join(project.projectRoot, 'node_modules', name))).toBe(await realpath(dependency))
    }
    for (const relative of ['dist', '.weapp-vite', '.tmp', '.cache', '.turbo', 'src/.cache', 'node_modules/marker']) {
      await expect(lstat(path.join(project.projectRoot, relative))).rejects.toMatchObject({ code: 'ENOENT' })
    }
    await writeFile(path.join(project.projectRoot, 'project.config.json'), JSON.stringify({
      libVersion: '3.13.2',
      setting: { useApiHostProcess: false, useIsolateContext: false, useMultiFrameRuntime: false },
    }))
    await writeFile(path.join(project.projectRoot, 'src/app.vue'), 'modified source')
    await mkdir(path.join(project.projectRoot, 'dist'))
    await writeFile(path.join(project.projectRoot, 'dist/app.js'), 'copied-build-output')

    await Promise.all([project.cleanup(), project.cleanup()])
    await project.cleanup()
    await expect(lstat(project.projectRoot)).rejects.toMatchObject({ code: 'ENOENT' })
    for (const [relative, content] of Object.entries(files)) {
      expect(await readFile(path.join(source, relative), 'utf8')).toBe(content)
    }
    for (const [name, dependency] of installed) {
      expect(await readFile(path.join(dependency, 'package.json'), 'utf8')).toBe(JSON.stringify({ name }))
    }
    expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('other-owner')
  })

  it.each(['directory', 'link'])('preserves an unknown %s replacing its owned path', async (replacement) => {
    const { source, parentDirectory, unknown } = await createWorkspace()
    const project = await createRetailParityProject(source, { parentDirectory })
    const releaseRuntime = project.retainRuntime()
    const moved = `${project.projectRoot}-moved`
    await rename(project.projectRoot, moved)
    if (replacement === 'link') {
      await symlink(await realpath(unknown), project.projectRoot, 'junction')
    }
    else {
      await mkdir(project.projectRoot)
      await writeFile(path.join(project.projectRoot, 'marker'), 'replacement-owner')
    }

    await expect(project.cleanup()).rejects.toThrow('runtime ownership remains active')
    releaseRuntime()
    await project.cleanup()
    await project.cleanup()
    expect(await readFile(path.join(project.projectRoot, 'marker'), 'utf8'))
      .toBe(replacement === 'link' ? 'other-owner' : 'replacement-owner')
    expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('other-owner')
    expect(await readFile(path.join(moved, 'src/app.vue'), 'utf8')).toContain('retail source')
    expect(await readFile(path.join(source, 'src/app.vue'), 'utf8')).toContain('retail source')
  })

  it('retains the project while a runtime launch is pending and after it rejects', async () => {
    const { source, parentDirectory, unknown } = await createWorkspace()
    const project = await createRetailParityProject(source, { parentDirectory })
    project.retainRuntime()
    const launch = Promise.withResolvers<void>()
    const failedLaunch = expect(launch.promise).rejects.toThrow('Window ownership unconfirmed')

    await expect(project.cleanup()).rejects.toThrow('runtime ownership remains active')
    expect(await readFile(path.join(project.projectRoot, 'src/app.vue'), 'utf8')).toContain('retail source')
    launch.reject(new Error('Window ownership unconfirmed'))
    await failedLaunch
    await expect(project.cleanup()).rejects.toThrow('runtime ownership remains active')
    expect(await readFile(path.join(project.projectRoot, 'src/app.vue'), 'utf8')).toContain('retail source')
    expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('other-owner')
  })

  it('waits for confirmed runtime closure before cleaning and releases each hold once', async () => {
    const { source, parentDirectory, unknown } = await createWorkspace()
    const project = await createRetailParityProject(source, { parentDirectory })
    const releaseRuntime = project.retainRuntime()
    const releaseOtherRuntime = project.retainRuntime()
    const close = Promise.withResolvers<void>()
    const closing = close.promise.then(releaseRuntime)

    await expect(project.cleanup()).rejects.toThrow('runtime ownership remains active')
    close.resolve()
    await closing
    releaseRuntime()
    await expect(project.cleanup()).rejects.toThrow('runtime ownership remains active')
    releaseOtherRuntime()
    await project.cleanup()
    await expect(lstat(project.projectRoot)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(path.join(source, 'src/app.vue'), 'utf8')).toContain('retail source')
    expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('other-owner')
  })

  it('rejects a new runtime after cleanup has started', async () => {
    const { source, parentDirectory } = await createWorkspace()
    const project = await createRetailParityProject(source, { parentDirectory })
    const cleaning = project.cleanup()

    expect(() => project.retainRuntime()).toThrow('project cleanup has started')
    await cleaning
    expect(() => project.retainRuntime()).toThrow('project cleanup has started')
  })

  it('retries cleanup after a temporary filesystem error', async () => {
    const { source, parentDirectory, unknown } = await createWorkspace()
    const project = await createRetailParityProject(source, { parentDirectory })
    const remove = vi.spyOn(fs, 'rm').mockRejectedValueOnce(Object.assign(new Error('Owned project is temporarily busy'), { code: 'EBUSY' }))
    try {
      await expect(project.cleanup()).rejects.toMatchObject({ code: 'EBUSY' })
      await expect(lstat(project.projectRoot)).resolves.toBeDefined()
      await project.cleanup()
      await expect(lstat(project.projectRoot)).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('other-owner')
    }
    finally {
      remove.mockRestore()
    }
  })

  it('removes only its partial project when a declared dependency is unavailable', async () => {
    const { source, parentDirectory, installed, unknown } = await createWorkspace()
    await rm(path.join(source, 'node_modules/@scope/config'))

    await expect(createRetailParityProject(source, { parentDirectory })).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readdir(parentDirectory)).toEqual(['other-project'])
    expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('other-owner')
    expect(await readFile(path.join(source, 'dist/app.js'), 'utf8')).toBe('source-build-output')
    expect(await readFile(path.join(installed.get('@scope/config')!, 'package.json'), 'utf8')).toBe('{"name":"@scope/config"}')
  })
})
