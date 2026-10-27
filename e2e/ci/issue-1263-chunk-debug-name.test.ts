import { access, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename } from '../utils/hmr-helpers'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CLI = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const DEBUG_NAME_WARNING = /output\.codeSplitting\.groups\[\d+\]\.name is a function|Set [`'"]?output\.codeSplitting\.groups\[\d+\]\.debugName|MISSING_CODE_SPLITTING_GROUP_DEBUG_NAME/

async function assertEmittedModules(project: string, marker: string) {
  const dist = path.join(project, 'dist')
  for (const route of ['pages/index/index', 'pages/second/index']) {
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(dist, `${route}.${extension}`))
    }
  }
  const files = (await readdir(dist, { recursive: true })).filter(file => file.endsWith('.js'))
  const modules = await Promise.all(files.map(async file => ({ file, source: await readFile(path.join(dist, file), 'utf8') })))
  expect(modules.some(module => module.source.includes(marker))).toBe(true)
  let relativeDependencies = 0
  for (const module of modules) {
    for (const match of module.source.matchAll(/require\((['"])(\.[^'"]+)\1\)/g)) {
      relativeDependencies += 1
      await access(path.resolve(dist, path.dirname(module.file), match[2]!))
    }
  }
  expect(relativeDependencies).toBeGreaterThan(0)
}

it('keeps CLI build, dev and a shared-module rebuild free of unnamed timing groups', async () => {
  const project = await createIssueRegressionProject(1263)
  let dev: ReturnType<typeof startDevProcess> | undefined
  try {
    const build = await buildIssueRegressionProject(project, 'weapp')
    expect(`${build.stdout}\n${build.stderr}`).not.toMatch(DEBUG_NAME_WARNING)
    await assertEmittedModules(project, 'issue1263-shared:')
    dev = startDevProcess(process.execPath, [CLI, 'dev', project, '--platform', 'weapp', '--skipNpm'], {
      cwd: ROOT,
      env: createDevProcessEnv(),
      all: true,
    })
    await dev.waitForInitialBuild()
    expect(dev.getOutput()).not.toMatch(DEBUG_NAME_WARNING)
    await assertEmittedModules(project, 'issue1263-shared:')
    const source = path.join(project, 'src/shared/label.js')
    const original = await readFile(source, 'utf8')
    await replaceFileByRename(source, original.replace('issue1263-shared:', 'issue1263-rebuilt:'))
    await dev.waitFor(expect.poll(async () => {
      const files = (await readdir(path.join(project, 'dist'), { recursive: true })).filter(file => file.endsWith('.js'))
      const sources = await Promise.all(files.map(file => readFile(path.join(project, 'dist', file), 'utf8')))
      return sources.some(text => text.includes('issue1263-rebuilt:'))
    }, { timeout: 45_000 }).toBe(true), 'shared-module rebuilt output')
    await assertEmittedModules(project, 'issue1263-rebuilt:')
    expect(dev.getOutput()).not.toMatch(DEBUG_NAME_WARNING)
    expect(dev.getBuildErrors()).toEqual([])
  }
  catch (error) {
    process.stdout.write(dev?.getOutput() ?? '')
    throw error
  }
  finally {
    await dev?.stop()
    await rm(project, { recursive: true, force: true })
  }
}, 180_000)
