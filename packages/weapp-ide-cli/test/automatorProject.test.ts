import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveAutomatorProjectPath } from '../src/cli/automatorProject'

const tempDirs: string[] = []

async function createTempProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-ide-cli-automator-project-'))
  tempDirs.push(root)
  return root
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>
}

describe('resolveAutomatorProjectPath', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(async tempDir => fs.rm(tempDir, {
      force: true,
      recursive: true,
    })))
  })

  it('creates a stable wrapper project from miniprogramRoot output', async () => {
    const root = await createTempProject()
    await writeJson(path.join(root, 'project.config.json'), {
      appid: 'wx-test',
      miniprogramRoot: 'dist/',
      pluginRoot: 'dist-plugin/',
      srcMiniprogramRoot: 'dist/',
    })
    await writeJson(path.join(root, 'project.private.config.json'), {
      condition: {},
      miniprogramRoot: 'dist/',
    })
    await writeJson(path.join(root, 'dist/app.json'), {
      pages: ['pages/index/index'],
    })
    await fs.mkdir(path.join(root, 'dist/pages/index'), { recursive: true })
    await fs.writeFile(path.join(root, 'dist/pages/index/index.js'), 'Page({})\n', 'utf8')
    await fs.mkdir(path.join(root, 'dist-plugin'), { recursive: true })
    await writeJson(path.join(root, 'dist-plugin/plugin.json'), {
      publicComponents: {},
    })

    const result = await resolveAutomatorProjectPath(root)

    expect(result.sourceProjectPath).toBe(path.resolve(root))
    expect(result.projectPath).not.toBe(path.resolve(root))
    await expect(fs.stat(path.join(result.projectPath, 'pages/index/index.js'))).resolves.toMatchObject({
      isFile: expect.any(Function),
    })
    await expect(fs.stat(path.join(result.projectPath, 'dist-plugin/plugin.json'))).resolves.toMatchObject({
      isFile: expect.any(Function),
    })
    await expect(readJson(path.join(result.projectPath, 'project.config.json'))).resolves.toMatchObject({
      miniprogramRoot: './',
      pluginRoot: 'dist-plugin/',
      srcMiniprogramRoot: './',
    })
    await expect(readJson(path.join(result.projectPath, 'project.private.config.json'))).resolves.toMatchObject({
      miniprogramRoot: './',
      srcMiniprogramRoot: './',
    })
    await expect(readJson(path.join(result.projectPath, 'app.json'))).resolves.toMatchObject({
      pages: ['pages/index/index'],
      subPackages: [],
    })

    await result.cleanup?.()
    await expect(fs.access(result.projectPath)).rejects.toThrow()
  })

  it('keeps the original project when miniprogramRoot output is not ready', async () => {
    const root = await createTempProject()
    await writeJson(path.join(root, 'project.config.json'), {
      miniprogramRoot: 'dist/',
    })

    const result = await resolveAutomatorProjectPath(root)

    expect(result.projectPath).toBe(path.resolve(root))
    expect(result.cleanup).toBeUndefined()
  })

  it('rejects unsafe pluginRoot paths while creating the wrapper', async () => {
    const root = await createTempProject()
    await writeJson(path.join(root, 'project.config.json'), {
      miniprogramRoot: 'dist/',
      pluginRoot: '../outside',
    })
    await writeJson(path.join(root, 'dist/app.json'), {
      pages: ['pages/index/index'],
      subPackages: [],
    })

    const result = await resolveAutomatorProjectPath(root)

    expect(result.projectPath).not.toBe(path.resolve(root))
    await expect(fs.access(path.join(result.projectPath, '..', 'outside'))).rejects.toThrow()
    await result.cleanup?.()
  })
})
