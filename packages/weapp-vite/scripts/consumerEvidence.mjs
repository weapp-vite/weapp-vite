import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { lstat, readdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { promisify } from 'node:util'

const execute = promisify(execFile)

/** 统计安装文件的逻辑字节；不把磁盘块、压缩下载量或启动加载量混为一谈。 */
export async function inspectConsumerInstallation(root) {
  const packages = []
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'))
  for (const location of Object.keys(lock.packages).filter(Boolean).sort()) {
    const directory = path.join(root, location)
    let manifest
    try {
      manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
    }
    catch (error) {
      if (error.code === 'ENOENT') {
        // lockfile 也包含当前平台未落盘的候选；原样记录，必需入口另由 exports/执行验收判定。
        const entry = lock.packages[location]
        packages.push({ location, version: entry.version, installed: false, optional: entry.optional ?? null, os: entry.os, cpu: entry.cpu, reason: 'not-present-in-installed-tree' })
        continue
      }
      throw error
    }
    packages.push({ location, name: manifest.name, version: manifest.version, installed: true, optional: Boolean(lock.packages[location].optional), os: manifest.os, cpu: manifest.cpu })
  }
  let fileBytes = 0
  let files = 0
  let links = 0
  const resolvedRoot = await realpath(root)
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(filename)
      }
      else if (entry.isSymbolicLink()) {
        const resolved = path.relative(resolvedRoot, await realpath(filename))
        assert(!resolved.startsWith(`..${path.sep}`) && !path.isAbsolute(resolved), 'Installed link escapes consumer')
        links++
      }
      else if (entry.isFile()) {
        fileBytes += (await lstat(filename)).size
        files++
      }
    }
  }
  await visit(path.join(root, 'node_modules'))
  return { measurement: 'logical-file-bytes-excluding-symlinks', fileBytes, files, links, packages }
}

/** 以独立进程分别采集无 hook 的启动样本及带 hook 的加载闭包，避免把探针开销当作提速。 */
export async function profileConsumerStartup(root, samples = 5) {
  const cli = path.join(root, 'node_modules/weapp-vite/bin/weapp-vite.js')
  const timings = []
  for (let index = 0; index < samples; index++) {
    const started = performance.now()
    await execute(process.execPath, [cli, '--help'], { cwd: root, timeout: 120_000, maxBuffer: 10 * 1024 * 1024 })
    timings.push({ index, wallMs: performance.now() - started })
  }
  const output = path.join(root, 'consumer-load-profile.json')
  await execute(process.execPath, ['--import', new URL('./consumerLoadProbe.mjs', import.meta.url).href, cli, '--help'], {
    cwd: root,
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, WEAPP_VITE_PROBE_ROOT: root, WEAPP_VITE_PROBE_OUTPUT: output },
  })
  const trace = JSON.parse(await readFile(output, 'utf8'))
  assert.equal(trace.exitCode, 0)
  return { command: 'wv --help', measurement: 'fresh-process-with-warm-filesystem-cache', uninstrumentedSamples: timings, trace }
}

/** 检查候选包公开入口的文件归属和发布完整性，包含类型与条件入口。 */
export async function verifyConsumerExports(root, candidates) {
  const verified = []
  for (const name of Object.keys(candidates).sort()) {
    const directory = path.join(root, 'node_modules', name)
    const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
    const files = []
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      // 包根的 node_modules 属于安装器；dist/node_modules 等已发布 vendor 仍须校验。
      if (entry.name === 'node_modules') {
        continue
      }
      files.push(entry.name)
      if (entry.isDirectory()) {
        files.push(...(await readdir(path.join(directory, entry.name), { recursive: true })).map(file => path.join(entry.name, file)))
      }
    }
    const resolvedDirectory = await realpath(directory)
    const targets = new Set()
    function collect(value) {
      if (typeof value === 'string') {
        targets.add(value)
      }
      else if (value && typeof value === 'object') {
        Object.values(value).forEach(collect)
      }
    }
    collect(manifest.exports)
    collect(manifest.bin)
    collect(manifest.types)
    collect(manifest.main)
    for (const target of targets) {
      const relative = target.replace(/^\.\//, '')
      assert(!path.isAbsolute(relative) && !relative.split(/[\\/]/).includes('..'), `Invalid published target: ${name} -> ${target}`)
      const expression = new RegExp(`^${relative.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
      const matches = []
      if (target.includes('*')) {
        for (const file of files.filter(file => expression.test(file.replaceAll('\\', '/')))) {
          // 通配导出描述一组文件，不承诺匹配到的中间目录也是模块入口。
          if (!(await lstat(path.join(directory, file))).isDirectory()) {
            matches.push(file)
          }
        }
      }
      else {
        // 显式入口独立于通配枚举，不能因安装目录被排除而绕过验证。
        try {
          await lstat(path.join(directory, relative))
          matches.push(relative)
        }
        catch (error) {
          if (error.code !== 'ENOENT') {
            throw error
          }
        }
      }
      assert(matches.length, `Missing published target: ${name}@${manifest.version} -> ${target}`)
      for (const match of matches) {
        const filename = path.join(directory, match)
        assert((await realpath(filename)).startsWith(`${resolvedDirectory}${path.sep}`), `Published target escapes candidate: ${name} -> ${target} (${match})`)
        assert((await lstat(filename)).isFile(), `Published target is not a file: ${name} -> ${target} (${match})`)
      }
    }
    verified.push({ name, version: manifest.version, targets: [...targets].sort() })
  }
  return verified
}

/** 对真实临时安装破坏入口并恢复，证明验收门禁确实拒绝缺失发布文件和错误 exports。 */
export async function verifyConsumerNegativeControls(root, candidates) {
  const directory = path.join(root, 'node_modules/weapp-vite')
  const manifestFile = path.join(directory, 'package.json')
  const original = await readFile(manifestFile, 'utf8')
  const missingTarget = './dist/consumer-negative-control-missing.mjs'
  try {
    const manifest = JSON.parse(original)
    manifest.exports['.'] = missingTarget
    await writeFile(manifestFile, JSON.stringify(manifest))
    await assert.rejects(verifyConsumerExports(root, candidates), /Missing published target: weapp-vite/)
    await assert.rejects(execute(process.execPath, ['--input-type=module', '-e', 'await import("weapp-vite")'], { cwd: root, timeout: 30_000 }), error => /ERR_MODULE_NOT_FOUND/.test(error.stderr))
  }
  finally {
    await writeFile(manifestFile, original)
  }
  const cli = path.join(directory, 'dist/cli.mjs')
  const { rename } = await import('node:fs/promises')
  await rename(cli, `${cli}.negative-control`)
  try {
    await assert.rejects(execute(process.execPath, [path.join(directory, 'bin/weapp-vite.js'), '--help'], { cwd: root, timeout: 30_000 }), error => /ERR_MODULE_NOT_FOUND/.test(error.stderr))
  }
  finally {
    await rename(`${cli}.negative-control`, cli)
  }
  return { brokenExportsRejected: true, missingCliRejected: true }
}
