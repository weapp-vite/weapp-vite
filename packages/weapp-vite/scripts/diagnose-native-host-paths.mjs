import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 保存原生崩溃退出码，且不终止其他诊断。
import { execa } from 'execa'
import { build } from 'vite'

// 独立诊断保留未经框架修复的原生输入；失败是证据，不能当框架门禁通过。
const fixture = path.resolve(import.meta.dirname, '../../../e2e-apps/react-runtime-spike')
const temporary = await mkdtemp(path.join(os.tmpdir(), 'weapp-native-path-diagnostic-'))
const results = []
try {
  const manifest = JSON.parse(await readFile(path.join(fixture, 'package.json'), 'utf8'))
  for (const layout of ['directory', 'packages']) {
    const root = path.join(temporary, layout)
    await mkdir(root)
    let stage = 'links'
    try {
      await writeFile(path.join(root, 'package.json'), JSON.stringify({ type: 'module', dependencies: manifest.dependencies }))
      if (layout === 'directory') {
        await symlink(path.join(fixture, 'node_modules'), path.join(root, 'node_modules'), 'junction')
      }
      else {
        for (const name of Object.keys(manifest.dependencies)) {
          const target = path.join(root, 'node_modules', name)
          await mkdir(path.dirname(target), { recursive: true })
          await symlink(await realpath(path.join(fixture, 'node_modules', name)), target, 'junction')
        }
      }
      stage = 'access-before-vite'
      await access(path.join(root, 'node_modules/@weapp-vite/react/dist/index.mjs'))
      const entry = path.join(root, 'index.ts')
      await writeFile(entry, 'export { createReactMiniProgramRoot } from "@weapp-vite/react"')
      stage = 'native-vite'
      await build({ root, configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' }, build: { lib: { entry, formats: ['es'] }, write: false } })
      results.push({ layout, stage, passed: true })
    }
    catch (error) {
      results.push({ layout, stage, passed: false, error: String(error) })
    }
  }
  for (const identity of ['provided', 'canonical']) {
    const root = path.join(temporary, identity)
    await mkdir(root)
    const watched = identity === 'canonical' ? await realpath(root) : root
    const result = await execa(process.execPath, ['--input-type=module', '-e', `
      import { watch, writeFileSync } from 'node:fs'
      import path from 'node:path'
      const root = process.argv[1]
      const timer = setTimeout(() => { watcher.close(); process.exitCode = 2 }, 5000)
      const watcher = watch(root, (_event, filename) => {
        if (filename === 'probe.txt') {
          clearTimeout(timer)
          watcher.close()
          console.log('observed')
        }
      })
      writeFileSync(path.join(root, 'probe.txt'), 'changed')
    `, watched], { reject: false, timeout: 10_000 })
    results.push({ identity, stage: 'native-fs-watch', passed: result.exitCode === 0 && result.stdout === 'observed', exitCode: result.exitCode, stderr: result.stderr, stdout: result.stdout })
  }
}
finally {
  await rm(temporary, { recursive: true, force: true })
}
console.log(JSON.stringify({ node: process.version, platform: process.platform, results }, null, 2))
process.exitCode = results.some(result => !result.passed) ? 1 : 0
