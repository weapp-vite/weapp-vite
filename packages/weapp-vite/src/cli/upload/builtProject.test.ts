import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { cac } from 'cac'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerBuildCommand } from '../commands/build'
import { runUploadCommand } from '../commands/upload'
import { resolveIdeCommandContext } from '../openIde'

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
  await writeFile(path.join(root, 'src/app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
  await writeFile(path.join(root, 'src/app.js'), 'App({})')
  await writeFile(path.join(root, 'src/pages/index/index.wxml'), '<view>{{marker}}</view>')
  await writeFile(path.join(root, 'src/pages/index/index.js'), 'Page({ data: { marker: "old-page" } })')
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

describe('upload output ownership', { timeout: 30000 }, () => {
  beforeEach(async () => {
    await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'fixture-app', miniprogramRoot: 'dist/' }))
    await writeConfig()
    await runBuild()
    await writeFile(path.join(root, 'src/pages/index/index.js'), 'Page({ data: { marker: "current-page" } })')
  })

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

async function writeInlineConfig(extra = '', write = true) {
  await writeFile(path.join(root, 'vite.config.mjs'), `export default ({ mode }) => {
    const common = { setting: { es6: false }, description: 'shared-settings' }
    return {
      logLevel: 'silent',
      weapp: {
        srcRoot: 'src',
        multiPlatform: {
          projectConfigs: {
            weapp: { ...common, appid: mode + '-weapp' },
            alipay: { ...common, appId: mode + '-alipay' },
            tt: { ...common, appid: mode + '-tt' },
            xhs: { ...common, appid: mode + '-xhs' },
            jd: { ...common, appid: mode + '-jd' },
            swan: { ...common, appid: mode + '-swan' }
          }
        }
      },
      build: { emptyOutDir: false, write: ${write} },
      ${extra}
    }
  }`)
}

describe('inline project config output ownership', { timeout: 60000 }, () => {
  beforeEach(async () => {
    await writeInlineConfig()
  })

  it('uploads dry-run builds for all six platforms using native configs beside app.json', async () => {
    await runUploadCommand(root, { platform: 'all', dryRun: true, mode: 'staging' })
    for (const [platform, fileName, rootKey, appidKey] of [
      ['weapp', 'project.config.json', 'miniprogramRoot', 'appid'],
      ['alipay', 'mini.project.json', 'miniprogramRoot', 'appId'],
      ['tt', 'project.config.json', 'miniprogramRoot', 'appid'],
      ['xhs', 'project.config.json', 'miniprogramRoot', 'appid'],
      ['jd', 'project.config.json', 'miniprogramRoot', 'appid'],
      ['swan', 'project.swan.json', 'smartProgramRoot', 'appid'],
    ] as const) {
      const codeRoot = path.join(root, 'dist', platform, 'dist')
      expect(JSON.parse(await readFile(path.join(codeRoot, fileName), 'utf8'))).toEqual({
        [appidKey]: `staging-${platform}`,
        [rootKey]: '.',
        compileType: 'miniprogram',
        description: 'shared-settings',
        setting: { es6: false },
      })
      expect(JSON.parse(await readFile(path.join(codeRoot, 'app.json'), 'utf8'))).toMatchObject({ pages: ['pages/index/index'] })
      expect(await readPage(`dist/${platform}/dist`)).toContain('old-page')
      expect(await readdir(path.dirname(codeRoot))).not.toContain(fileName)
      expect(await readdir(codeRoot)).not.toContain('project.private.config.json')
    }
    expect(await readdir(root)).not.toContain('project.config.json')
    const ide = await resolveIdeCommandContext({ cwd: root, platform: 'weapp', cliPlatform: 'weapp', mode: 'staging' })
    expect(path.resolve(ide.projectPath!)).toBe(path.join(root, 'dist/weapp/dist'))
    expect(JSON.parse(await readFile(path.join(ide.projectPath!, 'project.config.json'), 'utf8'))).toMatchObject({ appid: 'staging-weapp' })
  })

  it('accepts a CLI output override instead of selecting the older generated SDK project', async () => {
    await runBuild()
    await writeFile(path.join(root, 'src/pages/index/index.js'), 'Page({ data: { marker: "current-page" } })')
    await runBuild('--upload', '--dry-run', '--outDir', 'different-output', '--no-emptyOutDir')
    expect(await readPage('dist/xhs/dist')).toContain('old-page')
    expect(await readPage('different-output')).toContain('current-page')
    expect(JSON.parse(await readFile(path.join(root, 'different-output/project.config.json'), 'utf8'))).toMatchObject({
      appid: 'production-xhs',
      miniprogramRoot: '.',
    })
  })

  it('selects the generated IDE project at a configured custom code output', async () => {
    await writeInlineConfig(`build: { outDir: 'custom-output' },`)
    await runBuild()
    const ide = await resolveIdeCommandContext({ cwd: root, platform: 'xhs', cliPlatform: 'xhs', mode: 'production' })
    expect(path.resolve(ide.projectPath!)).toBe(path.join(root, 'custom-output'))
    expect(JSON.parse(await readFile(path.join(ide.projectPath!, 'project.config.json'), 'utf8'))).toMatchObject({
      appid: 'production-xhs',
      miniprogramRoot: '.',
    })
    const explicit = await resolveIdeCommandContext({ cwd: root, platform: 'xhs', projectPath: 'explicit-project' })
    expect(explicit.projectPath).toBe('explicit-project')
  })

  it('previews the current project when outputOptions redirects the final native write', async () => {
    await runBuild()
    await writeFile(path.join(root, 'src/pages/index/index.js'), 'Page({ data: { marker: "current-page" } })')
    await writeInlineConfig(`plugins: [{
      name: 'change-native-output',
      outputOptions(output) { return { ...output, dir: ${JSON.stringify(path.join(root, 'late-output'))} } }
    }],`)
    await runUploadCommand(root, { platform: 'xhs', dryRun: true }, 'preview')
    expect(await readPage('dist/xhs/dist')).toContain('old-page')
    expect(await readPage('late-output')).toContain('current-page')
    expect(JSON.parse(await readFile(path.join(root, 'late-output/project.config.json'), 'utf8'))).toMatchObject({
      appid: 'production-xhs',
      miniprogramRoot: '.',
    })
  })

  it('rejects stale generated configs when the current preview build has write disabled', async () => {
    await runUploadCommand(root, { platform: 'xhs', dryRun: true }, 'preview')
    await writeFile(path.join(root, 'src/pages/index/index.js'), 'Page({ data: { marker: "current-page" } })')
    await writeInlineConfig('', false)
    await expect(runUploadCommand(root, { platform: 'xhs', dryRun: true }, 'preview')).rejects.toThrow('本次构建未写出 app.json')
    expect(await readPage('dist/xhs/dist')).toContain('old-page')
    expect(await readPage('dist/xhs/dist')).not.toContain('current-page')
  })
})
