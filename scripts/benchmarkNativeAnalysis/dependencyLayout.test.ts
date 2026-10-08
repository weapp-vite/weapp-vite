import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { captureDependencyLayout, sanitizeDependencyPath } from './dependencyLayout'

const linkType = process.platform === 'win32' ? 'junction' : 'dir'

async function write(file: string, value: string) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, value)
}

describe('dependency layout diagnosis', () => {
  it('keeps the physical target of a relative package link beneath a staged node_modules link', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-layout-nested-')))
    const source = path.join(root, 'templates/source')
    const project = path.join(root, 'output/input/project')
    try {
      const packageRoot = path.join(root, 'packages/weapp-vite')
      await write(path.join(packageRoot, 'package.json'), '{"name":"weapp-vite","version":"1.2.3"}')
      const modules = path.join(source, 'node_modules')
      await mkdir(modules, { recursive: true })
      await mkdir(project, { recursive: true })
      await symlink(process.platform === 'win32' ? packageRoot : path.relative(modules, packageRoot), path.join(modules, 'weapp-vite'), linkType)
      await symlink(modules, path.join(project, 'node_modules'), linkType)
      const report = await captureDependencyLayout({ root, source, project })
      for (const location of report.locations.slice(0, 2)) {
        expect(location).toMatchObject({
          readlink: { ok: true, value: { target: '<repo>/packages/weapp-vite', relative: process.platform !== 'win32' } },
          realpath: { ok: true, value: '<repo>/packages/weapp-vite' },
          packageJson: { ok: true, value: { name: 'weapp-vite', version: '1.2.3' } },
        })
      }
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('records broken links and files directly even when package resolution succeeds through an ancestor', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-layout-')))
    const source = path.join(root, 'source')
    const project = path.join(root, 'stage/project')
    try {
      const packageJson = path.join(root, 'node_modules/weapp-vite/package.json')
      await write(packageJson, '{"name":"weapp-vite","version":"1.2.3"}')
      const brokenTarget = path.join(root, 'missing-package')
      await mkdir(brokenTarget)
      await mkdir(path.join(source, 'node_modules'), { recursive: true })
      await symlink(brokenTarget, path.join(source, 'node_modules/weapp-vite'), linkType)
      await rm(brokenTarget, { recursive: true })
      await write(path.join(project, 'node_modules/weapp-vite'), 'not a directory')
      const require = createRequire(path.join(project, 'package.json'))
      expect(require.resolve('weapp-vite/package.json')).toBe(packageJson)

      const report = await captureDependencyLayout({ root, source, project })
      const [original, staged, repository] = report.locations
      expect(original).toMatchObject({
        location: 'source',
        path: '<repo>/source/node_modules/weapp-vite',
        lstat: { ok: true, value: { isSymbolicLink: true } },
        stat: { ok: false, code: 'ENOENT' },
        readlink: { ok: true, value: { target: '<repo>/missing-package' } },
        realpath: { ok: false, code: 'ENOENT' },
        packageJson: { ok: false, code: 'ENOENT' },
      })
      expect(staged).toMatchObject({
        path: '<project>/node_modules/weapp-vite',
        lstat: { ok: true, value: { isDirectory: false, isSymbolicLink: false, isFile: true } },
        stat: { ok: true, value: { isDirectory: false } },
        packageJson: { ok: false, code: expect.stringMatching(/^(?:ENOENT|ENOTDIR)$/) },
      })
      expect(repository).toMatchObject({
        path: '<repo>/node_modules/weapp-vite',
        stat: { ok: true, value: { isDirectory: true } },
        packageJson: { ok: true, value: { name: 'weapp-vite', version: '1.2.3' } },
      })
      const json = JSON.stringify(report)
      expect(json).not.toContain(root)
      expect(json).not.toContain('message')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('hashes external targets and unexpected manifest path values while retaining read failures as codes', async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-layout-private-')))
    const external = await realpath(await mkdtemp(path.join(tmpdir(), 'native-layout-external-')))
    const source = path.join(root, 'source')
    const project = path.join(root, 'project')
    try {
      await write(path.join(external, 'package.json'), JSON.stringify({ name: external, version: external, privateField: external }))
      await mkdir(path.join(source, 'node_modules'), { recursive: true })
      await symlink(external, path.join(source, 'node_modules/weapp-vite'), linkType)
      await write(path.join(project, 'node_modules/weapp-vite/package.json'), '{invalid json')
      const report = await captureDependencyLayout({ root, source, project })
      expect(report.locations[0]).toMatchObject({
        readlink: { ok: true, value: { target: expect.stringMatching(/^<external:[a-f\d]{16}>$/) } },
        realpath: { ok: true, value: expect.stringMatching(/^<external:[a-f\d]{16}>$/) },
        packageJson: { ok: true, value: { name: expect.stringMatching(/^<redacted:/), version: expect.stringMatching(/^<redacted:/) } },
      })
      expect(report.locations[1]?.packageJson).toEqual({ ok: false, code: 'INVALID_PACKAGE_JSON' })
      expect(report.locations[2]?.lstat).toEqual({ ok: false, code: 'ENOENT' })
      const json = JSON.stringify(report)
      expect(json).not.toContain(root)
      expect(json).not.toContain(external)
      expect(json).not.toContain('privateField')
    }
    finally {
      await rm(root, { recursive: true, force: true })
      await rm(external, { recursive: true, force: true })
    }
  })

  it('normalizes Windows case, separators and junction prefixes without leaking external or neighboring roots', () => {
    const roots = { root: 'D:\\checkout\\repo', project: 'D:\\checkout\\repo\\output\\project' }
    expect(sanitizeDependencyPath('d:/CHECKOUT/repo/output/project/node_modules/weapp-vite', roots)).toBe('<project>/node_modules/weapp-vite')
    expect(sanitizeDependencyPath('\\\\?\\D:\\checkout\\repo\\packages\\weapp-vite', roots)).toBe('<repo>/packages/weapp-vite')
    for (const candidate of ['D:\\checkout\\repo-copy\\private', 'D:\\checkout\\repo\\..\\private', 'E:\\private\\weapp-vite']) {
      expect(sanitizeDependencyPath(candidate, roots)).toMatch(/^<external:[a-f\d]{16}>$/)
    }
    expect(sanitizeDependencyPath('\\\\?\\UNC\\server\\share\\repo\\packages\\weapp-vite', {
      root: '\\\\server\\share\\repo',
      project: '\\\\server\\share\\repo\\stage',
    })).toBe('<repo>/packages/weapp-vite')
  })
})
