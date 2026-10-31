import type { PackageJson } from 'pkg-types'
import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import { recommended } from '@weapp-vite/oxfmt'
import { formatDocument } from '@weapp-vite/oxfmt/languages'
import { formatWxml } from '@weapp-vite/oxfmt/wxml'
// eslint-disable-next-line e18e/ban-dependencies -- 使用与发布准备一致的跨平台 CLI 启动方式。
import { execa } from 'execa'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareVitePlusTemplates } from '../scripts/vitePlusTemplates'
import { __internal } from '../src/createProject'
import { createProject, TemplateName } from '../src/index'
import { TEMPLATE_DEFINITIONS } from '../src/templates'

const roots: string[] = []
const packageRoot = path.resolve(import.meta.dirname, '..')

async function temporaryRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-plus-generated-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => fs.remove(root)))
})

describe('prepared Vite Plus templates', () => {
  it.each(TEMPLATE_DEFINITIONS)('creates a formatted $id project before its first install', async (template) => {
    const parent = await temporaryRoot()
    const root = path.join(parent, 'app')
    const config = path.join(parent, 'formatter.json')
    await fs.writeJSON(config, recommended)
    await createProject(root, template.id, { toolchain: 'vite-plus' })
    const pkg = await fs.readJSON(path.join(root, 'package.json')) as PackageJson
    expect(pkg.scripts).toMatchObject({
      'lint': 'weapp-vite-lint',
      'lint:fix': 'weapp-vite-lint --fix',
      'format': 'weapp-vite-format --write',
      'format:check': 'weapp-vite-format --check',
      'check': 'weapp-vite-format --check-all',
    })
    expect(pkg.scripts?.postinstall).toMatch(/^wv prepare/)
    expect(pkg.scripts?.postinstall).not.toContain('fmt')
    expect(pkg.devDependencies?.['@weapp-vite/oxlint']).toMatch(/^\^\d/)
    expect(pkg.devDependencies?.['@weapp-vite/oxfmt']).toMatch(/^\^\d/)
    expect(pkg.devDependencies).not.toHaveProperty('@icebreakers/eslint-config')
    expect(JSON.stringify(pkg)).not.toMatch(/workspace:|catalog:/)
    const host = await fs.readFile(path.join(root, 'vite.config.ts'), 'utf8')
    expect(host).toContain('lazyPlugins(')
    expect(host).toContain('@weapp-vite/oxlint')
    expect(host).toContain('@weapp-vite/oxfmt')
    expect(host).toContain(template.framework === 'wevu' ? 'wevuRecommended' : template.framework === 'react' ? 'reactRecommended' : 'miniProgramRecommended')
    const agents = await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8')
    expect(agents).toContain('@weapp-vite/oxlint')
    expect(agents).toContain('pnpm format:check')
    expect(agents).not.toContain('项目 ESLint 配置应接入')
    const { stdout } = await execa('oxfmt', ['--config', config, '--check', '.'], {
      cwd: root,
      preferLocal: true,
      localDir: packageRoot,
    })
    expect(stdout).toContain('All matched files use the correct format')
    for (const file of await fs.readdir(root, { recursive: true })) {
      if (String(file).endsWith('.wxml')) {
        const content = await fs.readFile(path.join(root, String(file)), 'utf8')
        expect(await formatWxml(content, String(file), recommended)).toBe(content)
      }
    }
  })

  it.each([TemplateName.wevu, TemplateName.react, TemplateName.plugin, TemplateName.lib])('retains Vue template checks for %s including mixed projects', async (template) => {
    const root = await temporaryRoot()
    await createProject(root, template, { toolchain: 'vite-plus' })
    const pkg = await fs.readJSON(path.join(root, 'package.json')) as PackageJson
    expect(pkg.scripts?.['lint:vue']).toContain('eslint')
    const config = await fs.readFile(path.join(root, 'eslint.config.js'), 'utf8')
    expect(config).toContain('wevu/no-unsupported-template-feature')
    expect(config).not.toContain('@icebreakers/eslint-config')
  })

  it('lets Oxfmt own style layout while retaining Stylelint semantic errors', async () => {
    const { preferredTemplateDir } = await __internal.resolveTemplateDirs(TemplateName.default, 'vite-plus')
    const config = path.join(preferredTemplateDir, 'stylelint.config.js')
    const source = '@import url("./shared.wxss");page{width:120rpx;--spacing:4rpx}/* #ifdef MP-WEIXIN */\n@media (max-width:10rpx){view:before{content:"x"}}/* #endif */'
    const formatted = await formatDocument(source, 'app.wxss')
    const options = { preferLocal: true, localDir: packageRoot, cwd: packageRoot }
    await expect(execa('stylelint', ['--config', config, '--stdin', '--stdin-filename', 'app.wxss'], { ...options, input: formatted })).resolves.toMatchObject({ exitCode: 0 })
    const invalid = await execa('stylelint', ['--config', config, '--stdin', '--stdin-filename', 'app.wxss'], { ...options, input: 'page { color: #xyz; }', reject: false })
    expect(invalid.exitCode).toBe(2)
    expect(`${invalid.stdout}\n${invalid.stderr}`).toContain('color-no-invalid-hex')
  })

  it('does not fall back to raw source when a prepared template is missing', async () => {
    const exists = fs.pathExists.bind(fs)
    vi.spyOn(fs, 'pathExists').mockImplementation((file: string) => {
      if (String(file).split(path.sep).join('/').endsWith('/templates/vite-plus/default')) {
        return Promise.resolve(false)
      }
      return exists(file)
    })
    const parent = await temporaryRoot()
    const target = path.join(parent, 'missing')
    await expect(createProject(target, TemplateName.default, { toolchain: 'vite-plus' })).rejects.toThrow('templates:prepare')
    expect(await fs.pathExists(target)).toBe(false)
  })

  it('preserves a user-owned AGENTS file when copying a prepared template', async () => {
    const root = await temporaryRoot()
    const instructions = '# Custom project instructions\n\nKeep this file unchanged.\n'
    await fs.writeFile(path.join(root, 'AGENTS.md'), instructions)
    await createProject(root, TemplateName.default, { toolchain: 'vite-plus' })
    expect(await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8')).toBe(instructions)
  })

  it('reuses valid prepared outputs without rewriting source or derived files', async () => {
    const { preferredTemplateDir } = await __internal.resolveTemplateDirs(TemplateName.default, 'vite-plus')
    const file = path.join(preferredTemplateDir, 'vite.config.ts')
    const before = await fs.stat(file)
    const content = await fs.readFile(file, 'utf8')
    await prepareVitePlusTemplates()
    expect((await fs.stat(file)).mtimeMs).toBe(before.mtimeMs)
    expect(await fs.readFile(file, 'utf8')).toBe(content)
  })
})
