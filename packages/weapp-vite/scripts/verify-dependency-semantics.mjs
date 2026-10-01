import assert from 'node:assert/strict'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 发布消费者需跨平台启动 CLI。
import { execa } from 'execa'

/** 通过独立发布包验证 TS6 继承、三种解析模式和实际 CSS 转换链。 */
export async function verifyDependencySemantics(root) {
  const require = createRequire(path.join(root, 'package.json'))
  const load = async (owner, specifier) => {
    const file = await realpath(owner.resolve(specifier))
    assert(file.startsWith(`${await realpath(root)}${path.sep}node_modules${path.sep}`), `Dependency escaped consumer: ${specifier}`)
    return import(pathToFileURL(file).href)
  }
  const compilerRequire = createRequire(require.resolve('weapp-vite/package.json'))
  const ts = (await load(require, 'typescript')).default
  assert.equal(ts.version, '6.0.3')
  const core = await load(compilerRequire, 'weapp-tailwindcss/core')
  const compiler = core.createCompiler({ appType: 'weapp-vite', tailwindcssBasedir: root })
  let css
  try {
    css = (await compiler.transformCss('.hsl { color: hsl(120 100% 50%); } .srgb { color: color(srgb 1 0 0 / 0.5); } .mix { color: color-mix(in srgb, #ff0000 50%, #0000ff); }', compiler.createSnapshot({ id: 'dependency-colors', classSet: ['hsl', 'srgb', 'mix'], target: 'weapp' }))).css
    const colors = []
    core.postcss.parse(css).walkDecls('color', declaration => colors.push(declaration.value))
    assert.deepEqual(colors, ['hsl(120, 100%, 50%)', 'rgba(255, 0, 0, 0.5)', 'rgb(128, 0, 128)'])
  }
  finally {
    await compiler.dispose()
  }
  const files = {
    'node_modules/@compat/tsconfig/package.json': JSON.stringify({ name: '@compat/tsconfig', version: '1.0.0', tsconfig: 'base.json' }),
    'node_modules/@compat/tsconfig/base.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true, skipLibCheck: true, types: [] } }),
    'configs/old.json': JSON.stringify({ compilerOptions: { paths: { '@value/*': ['./missing/*'], '@obsolete/*': ['./missing/*'] } } }),
    'configs/paths.json': JSON.stringify({ compilerOptions: { paths: { '@value/*': ['../compat-src/shared/*'], '@pattern/*/data': ['../compat-src/shared/*/data'] } } }),
    'compat-src/app.ts': 'App({})',
    'compat-src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'compat-src/shared/value.ts': 'export const value: string = "issue-1132-inherited"',
    'compat-src/shared/pattern/data.ts': 'export const value: string = "issue-1132-pattern"',
    'compat-src/pages/index/index.json': '{}',
    'compat-src/pages/index/index.wxml': '<view>{{message}}</view>',
    'compat-src/pages/index/index.wxss': '.probe { color: #008000; }',
    'project.config.json': JSON.stringify({ miniprogramRoot: 'compat-dist' }),
  }
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true })
    await writeFile(path.join(root, name), content)
  }
  const configFile = path.join(root, 'tsconfig.json')
  const modes = [{ name: 'default' }, { name: 'native', options: true }, { name: 'advanced', options: { projects: ['tsconfig.json'], parseNative: true } }]
  const results = []
  const cli = path.join(path.dirname(compilerRequire.resolve('weapp-vite/package.json')), 'bin/weapp-vite.js')
  for (const mode of modes) {
    await writeFile(configFile, JSON.stringify({ extends: ['@compat/tsconfig/base.json', './configs/old.json', './configs/paths.json'], files: ['compat-src/probe.ts'] }))
    const specifier = mode.name === 'advanced' ? '@pattern/pattern/data' : '@value/value'
    const marker = mode.name === 'advanced' ? 'issue-1132-pattern' : 'issue-1132-inherited'
    await writeFile(path.join(root, 'compat-src/probe.ts'), `import { value } from '${specifier}'; export const message: string = value`)
    await writeFile(path.join(root, 'compat-src/pages/index/index.ts'), 'import { message } from "../../probe"; Page({ data: { message } })')
    const parsed = ts.getParsedCommandLineOfConfigFile(configFile, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => assert.fail(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')) })
    assert.deepEqual(parsed.errors, [])
    assert.equal(parsed.options.paths['@obsolete/*'], undefined, 'extends arrays must replace complete paths mappings')
    const program = ts.createProgram(parsed.fileNames, parsed.options)
    assert.deepEqual(ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), [])
    await writeFile(path.join(root, 'compat.config.mts'), `import { defineConfig } from 'weapp-vite'; export default defineConfig({ build: { outDir: 'compat-dist', minify: false }, weapp: { srcRoot: 'compat-src', autoRoutes: false, mcp: false, tsconfigPaths: ${JSON.stringify(mode.options) ?? 'undefined'} } })`)
    await execa(process.execPath, [cli, 'prepare', '--config', 'compat.config.mts'], { cwd: root, timeout: 120_000 })
    await execa(process.execPath, [cli, 'build', '--config', 'compat.config.mts'], { cwd: root, timeout: 120_000 })
    const output = await readFile(path.join(root, 'compat-dist/pages/index/index.js'), 'utf8')
    assert(output.includes(marker), `${mode.name}: resolved value must reach emitted page`)
    results.push({ mode: mode.name, marker, typeDiagnostics: 0 })
  }
  return { typescript: ts.version, aliases: results, css }
}
