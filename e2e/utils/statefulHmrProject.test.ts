import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createStatefulHmrProject } from './statefulHmrProject'

const workspaces: string[] = []

async function createWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'stateful-hmr-project-test-'))
  workspaces.push(root)
  const fixture = path.join(root, 'e2e-apps/stateful-hmr')
  const files = {
    'src/pages/index.ts': 'Page({ data: { count: 0 } })',
    'public/icon.png': 'asset',
    'package.json': '{"private":true}',
    'project.config.json': '{"miniprogramRoot":"dist"}',
    'project.private.config.json': '{"setting":{"compileHotReLoad":true}}',
    'weapp-vite.config.ts': 'export default { weapp: { srcRoot: "src" } }',
    'dist/app.js': 'manual-ide-output',
    '.cache/marker': 'fixture-cache',
    'node_modules/marker': 'fixture-dependencies',
    'src/.cache/marker': 'nested-cache',
  }
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(fixture, relative)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, content)
  }
  for (const relative of ['packages/weapp-vite', 'packages-runtime/wevu']) {
    await mkdir(path.join(root, relative), { recursive: true })
    await writeFile(path.join(root, relative, 'package.json'), '{}')
  }
  const unknown = path.join(root, '.tmp/e2e-projects/unknown-project')
  await mkdir(unknown, { recursive: true })
  await writeFile(path.join(unknown, 'marker'), 'unknown-owner')
  return { root, fixture, unknown }
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('isolated stateful HMR workspace project', () => {
  it('isolates edits and output while preserving the source fixture, dependencies, and other projects', async () => {
    const { root, fixture, unknown } = await createWorkspace()
    const project = await createStatefulHmrProject(root)
    expect(path.dirname(project.projectRoot)).toBe(path.join(root, '.tmp/e2e-projects'))
    expect(await readFile(path.join(project.projectRoot, 'src/pages/index.ts'), 'utf8')).toBe('Page({ data: { count: 0 } })')
    expect(await readFile(path.join(project.projectRoot, 'public/icon.png'), 'utf8')).toBe('asset')
    expect(await readFile(path.join(project.projectRoot, 'project.config.json'), 'utf8')).toBe('{"miniprogramRoot":"dist"}')
    for (const relative of ['dist', '.cache', 'src/.cache', 'node_modules/marker']) {
      await expect(lstat(path.join(project.projectRoot, relative))).rejects.toMatchObject({ code: 'ENOENT' })
    }
    expect(await realpath(path.join(project.projectRoot, 'node_modules/weapp-vite'))).toBe(await realpath(path.join(root, 'packages/weapp-vite')))
    expect(await realpath(path.join(project.projectRoot, 'node_modules/wevu'))).toBe(await realpath(path.join(root, 'packages-runtime/wevu')))
    await writeFile(path.join(project.projectRoot, 'src/pages/index.ts'), 'edited')
    await mkdir(path.join(project.projectRoot, 'dist'))
    await writeFile(path.join(project.projectRoot, 'dist/app.js'), 'generated')
    expect(await readFile(path.join(fixture, 'src/pages/index.ts'), 'utf8')).toBe('Page({ data: { count: 0 } })')
    expect(await readFile(path.join(fixture, 'dist/app.js'), 'utf8')).toBe('manual-ide-output')

    await Promise.all([project.cleanup(), project.cleanup()])
    await project.cleanup()
    await expect(lstat(project.projectRoot)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('unknown-owner')
    expect(await readFile(path.join(fixture, 'node_modules/marker'), 'utf8')).toBe('fixture-dependencies')
    expect(await readFile(path.join(root, 'packages/weapp-vite/package.json'), 'utf8')).toBe('{}')
    expect(await readFile(path.join(root, 'packages-runtime/wevu/package.json'), 'utf8')).toBe('{}')
  })

  it.each(['directory', 'link'])('does not remove an unknown %s replacing its owned path', async (replacement) => {
    const { root, unknown } = await createWorkspace()
    const project = await createStatefulHmrProject(root)
    const moved = `${project.projectRoot}-moved`
    await rename(project.projectRoot, moved)
    if (replacement === 'link') {
      await symlink(await realpath(unknown), project.projectRoot, 'junction')
    }
    else {
      await mkdir(project.projectRoot)
      await writeFile(path.join(project.projectRoot, 'marker'), 'replacement-owner')
    }

    await project.cleanup()
    await project.cleanup()
    expect((await lstat(project.projectRoot)).isSymbolicLink()).toBe(replacement === 'link')
    expect(await readFile(path.join(project.projectRoot, 'marker'), 'utf8')).toBe(replacement === 'link' ? 'unknown-owner' : 'replacement-owner')
    expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('unknown-owner')
    expect(await readFile(path.join(moved, 'public/icon.png'), 'utf8')).toBe('asset')
  })

  it('cleans up only its partially prepared directory when a dependency is unavailable', async () => {
    const { root, fixture, unknown } = await createWorkspace()
    await rm(path.join(root, 'packages-runtime/wevu'), { recursive: true })

    await expect(createStatefulHmrProject(root)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readdir(path.join(root, '.tmp/e2e-projects'))).toEqual(['unknown-project'])
    expect(await readFile(path.join(unknown, 'marker'), 'utf8')).toBe('unknown-owner')
    expect(await readFile(path.join(fixture, 'dist/app.js'), 'utf8')).toBe('manual-ide-output')
  })
})
