import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { cac } from 'cac'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerBuildCommand } from '../commands/build'

let root: string

async function runBuild(...args: string[]) {
  const cli = cac()
  registerBuildCommand(cli)
  cli.parse(['node', 'wv', 'build', root, '-p', 'xhs', ...args], { run: false })
  await cli.runMatchedCommand()
}

async function writeConfig(extra = '', write = true) {
  await writeFile(path.join(root, 'vite.config.mjs'), `export default {
    logLevel: 'silent',
    weapp: { platform: 'xhs', srcRoot: 'src' },
    build: { emptyOutDir: false, write: ${write} },
    ${extra}
  }`)
}

function readPage(directory: string) {
  return readFile(path.join(root, directory, 'pages/index/index.js'), 'utf8')
}

beforeEach(async () => {
  vi.stubEnv('VITEST', 'true')
  root = await mkdtemp(path.join(os.tmpdir(), 'weapp-upload-output-'))
  await mkdir(path.join(root, 'src/pages/index'), { recursive: true })
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'upload-output-fixture', version: '1.2.3', type: 'module' }))
  await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'fixture-app', miniprogramRoot: 'dist/' }))
  await writeFile(path.join(root, 'src/app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
  await writeFile(path.join(root, 'src/app.js'), 'App({})')
  await writeFile(path.join(root, 'src/pages/index/index.wxml'), '<view>{{marker}}</view>')
  await writeFile(path.join(root, 'src/pages/index/index.js'), 'Page({ data: { marker: "old-page" } })')
  await writeConfig()
  await runBuild()
  await writeFile(path.join(root, 'src/pages/index/index.js'), 'Page({ data: { marker: "current-page" } })')
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

describe('upload output ownership', { timeout: 30000 }, () => {
  it('rejects an old SDK root after a CLI output override even when both builds exist', async () => {
    await expect(runBuild('--upload', '--dry-run', '--outDir', 'different-output', '--no-emptyOutDir')).rejects.toThrow()
    expect(await readPage('dist')).toContain('old-page')
    expect(await readPage('different-output')).toContain('current-page')
  })

  it('rejects an old SDK root when a Vite plugin changes the final output directory', async () => {
    await writeConfig(`plugins: [{ name: 'change-output', config() { return { build: { outDir: 'different-output' } } } }],`)
    await expect(runBuild('--upload', '--dry-run')).rejects.toThrow()
    expect(await readPage('dist')).toContain('old-page')
    expect(await readPage('different-output')).toContain('current-page')
  })

  it('accepts the current written output when the SDK root matches a Vite plugin override', async () => {
    await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'fixture-app', miniprogramRoot: 'different-output/' }))
    await writeConfig(`plugins: [{ name: 'change-output', config() { return { build: { outDir: 'different-output' } } } }],`)
    await runBuild('--upload', '--dry-run')
    expect(await readPage('different-output')).toContain('current-page')
    expect(JSON.parse(await readFile(path.join(root, 'different-output/app.json'), 'utf8'))).toMatchObject({ pages: ['pages/index/index'] })
  })

  it('rejects old output when the current build does not write any files', async () => {
    await writeConfig('', false)
    await expect(runBuild('--upload', '--dry-run')).rejects.toThrow()
    expect(await readPage('dist')).toContain('old-page')
    expect(await readPage('dist')).not.toContain('current-page')
  })
})
