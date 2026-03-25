import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadProject } from '../src/project'

function writeJson(target: string, value: Record<string, any>) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(value, null, 2))
}

describe('loadProject', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('loads routes from built app config under miniprogramRoot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-project-'))
    tempDirs.push(root)

    writeJson(path.join(root, 'project.config.json'), {
      appid: 'wx123',
      miniprogramRoot: 'dist',
    })
    writeJson(path.join(root, 'dist/app.json'), {
      pages: [
        'pages/index/index',
      ],
      subPackages: [
        {
          root: 'pkg',
          pages: ['foo/index'],
        },
      ],
    })

    const project = loadProject(root)

    expect(project.projectPath).toBe(root)
    expect(project.miniprogramRoot).toBe('dist')
    expect(project.routes).toEqual([
      {
        kind: 'page',
        route: 'pages/index/index',
        source: 'pages',
      },
      {
        kind: 'page',
        route: 'pkg/foo/index',
        source: 'subPackages',
        subpackageRoot: 'pkg',
      },
    ])
  })

  it('prefers project.private.config.json when resolving miniprogramRoot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-project-'))
    tempDirs.push(root)

    writeJson(path.join(root, 'project.config.json'), {
      appid: 'wx123',
      miniprogramRoot: 'dist-old',
    })
    writeJson(path.join(root, 'project.private.config.json'), {
      miniprogramRoot: 'dist',
    })
    writeJson(path.join(root, 'dist/app.json'), {
      pages: ['pages/home/index'],
    })

    const project = loadProject(root)
    expect(project.miniprogramRoot).toBe('dist')
    expect(project.appConfigPath).toBe(path.join(root, 'dist/app.json'))
  })

  it('reads a real built e2e app from the repository', () => {
    const project = loadProject(path.resolve(import.meta.dirname, '../../../../e2e-apps/base'))

    expect(project.miniprogramRootPath.endsWith(path.normalize('e2e-apps/base/dist'))).toBe(true)
    expect(project.routes.some(route => route.route === 'pages/index/index')).toBe(true)
  })

  it('throws when built app.json is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-project-'))
    tempDirs.push(root)

    writeJson(path.join(root, 'project.config.json'), {
      appid: 'wx123',
      miniprogramRoot: 'dist',
    })
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true })

    expect(() => loadProject(root)).toThrowError(/Missing built app\.json/)
  })
})
