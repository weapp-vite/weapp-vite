import { access, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildIssue1185Project, createIssue1185Project } from '../utils/issue1185Project'

const projects: string[] = []
afterEach(async () => {
  await Promise.all(projects.splice(0).map(project => rm(project, { recursive: true, force: true })))
})

describe('issue #1185: sibling scripts keep their module identity', () => {
  it.each([false, true])('does not promote imported siblings to root chunks (minify: %s)', async (minify) => {
    const project = await createIssue1185Project()
    projects.push(project)
    const configPath = path.join(project, 'weapp-vite.config.ts')
    if (minify) {
      await writeFile(configPath, (await readFile(configPath, 'utf8')).replace('minify: false', 'minify: true'))
    }
    await buildIssue1185Project(project)
    const dist = path.join(project, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => file.replaceAll('\\', '/'))
    for (const entry of ['pages/component/index', 'components/foo/foo', 'pages/bar/bar', 'pages/unused/unused']) {
      for (const extension of ['js', 'json', 'wxml']) {
        await access(path.join(dist, `${entry}.${extension}`))
      }
    }
    expect.soft(files).not.toContain('foo.js')
    expect.soft(files).not.toContain('bar.js')
    expect.soft(files).not.toContain('unused.js')
    const scripts = await Promise.all(files.filter(file => file.endsWith('.js')).map(file => readFile(path.join(dist, file), 'utf8')))
    expect.soft(scripts.join('\n').match(/require\(["'](?:\.\.\/)+(?:foo|bar|unused)\.js["']\)/g)).toBeNull()
    expect(scripts.join('\n')).not.toContain('unusedSiblingValue')
    const app = JSON.parse(await readFile(path.join(dist, 'app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual(expect.arrayContaining(['pages/component/index', 'pages/bar/bar', 'pages/unused/unused']))
  })
})
