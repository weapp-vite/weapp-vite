import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { validateUploadProject } from './project'

let root: string
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'weapp-upload-project-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('upload artifact identity', () => {
  it('accepts the emitted code root selected by the platform configuration', async () => {
    const outDir = path.join(root, 'dist')
    await mkdir(outDir)
    await writeFile(path.join(outDir, 'app.json'), '{}')
    await writeFile(path.join(root, 'project.swan.json'), JSON.stringify({ smartProgramRoot: 'dist' }))
    await validateUploadProject({ platform: 'swan', projectPath: root, outDir })

    await writeFile(path.join(root, 'project.swan.json'), JSON.stringify({ smartProgramRoot: 'missing', miniprogramRoot: 'dist' }))
    await expect(validateUploadProject({ platform: 'swan', projectPath: root, outDir })).rejects.toThrow()
  })

  it('rejects an older valid app under a nested config instead of uploading it', async () => {
    const outDir = path.join(root, 'dist')
    const projectPath = path.join(root, 'configs')
    await mkdir(outDir)
    await mkdir(path.join(projectPath, 'dist'), { recursive: true })
    await writeFile(path.join(outDir, 'app.json'), '{"pages":["fresh"]}')
    await writeFile(path.join(projectPath, 'dist/app.json'), '{"pages":["stale"]}')
    await writeFile(path.join(projectPath, 'project.config.json'), '{"miniprogramRoot":"dist"}')
    await expect(validateUploadProject({ platform: 'jd', projectPath, outDir })).rejects.toThrow('本次构建输出不一致')
  })

  it('rejects a selected nonstandard configuration rather than reading a sibling', async () => {
    await expect(validateUploadProject({
      platform: 'weapp',
      projectPath: root,
      outDir: path.join(root, 'dist'),
      sourceConfigPath: path.join(root, 'custom.json'),
    })).rejects.toThrow('标准文件名')
  })
})
