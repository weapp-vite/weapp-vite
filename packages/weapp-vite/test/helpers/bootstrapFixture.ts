import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageDirectory = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(new URL('../../package.json', import.meta.url))
const registryDependencies = ['semver', 'picocolors'] as const

interface BootstrapExecution {
  exitCode: number
  stdout: string
  stderr: string
}

/** 在没有工作区构建产物的独立目录中，以真实 Node 执行启动代码。 */
export async function runBootstrapFixture(args: string[], variables: NodeJS.ProcessEnv = { NO_COLOR: '1' }): Promise<BootstrapExecution> {
  const root = await mkdtemp(path.join(tmpdir(), 'weapp-vite-bootstrap-'))
  try {
    const manifest = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }
    await copyFile(path.join(packageDirectory, 'package.json'), path.join(root, 'package.json'))
    await mkdir(path.join(root, 'bin'))
    for (const entry of await readdir(path.join(packageDirectory, 'bin'), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.js')) {
        await copyFile(path.join(packageDirectory, 'bin', entry.name), path.join(root, 'bin', entry.name))
      }
    }
    for (const dependency of registryDependencies) {
      if (!manifest.dependencies[dependency] || manifest.dependencies[dependency].startsWith('workspace:')) {
        throw new Error(`启动依赖必须直接声明为注册表包：${dependency}`)
      }
      const source = path.dirname(require.resolve(`${dependency}/package.json`))
      await cp(source, path.join(root, 'node_modules', dependency), {
        recursive: true,
        dereference: true,
        filter: filename => path.basename(filename) !== 'node_modules',
      })
    }
    assert.deepEqual((await readdir(path.join(root, 'node_modules'))).sort(), [...registryDependencies].sort())
    const env = { ...process.env }
    for (const name of Object.keys(env)) {
      if (['NODE_OPTIONS', 'NODE_PATH', 'NO_COLOR', 'FORCE_COLOR', 'CLICOLOR', 'CLICOLOR_FORCE', 'CI'].includes(name.toUpperCase())) {
        delete env[name]
      }
    }
    Object.assign(env, { TERM: 'dumb' }, variables)
    return await new Promise<BootstrapExecution>((resolve, reject) => {
      execFile(process.execPath, args, { cwd: root, env, encoding: 'utf8', timeout: 15_000 }, (error, stdout, stderr) => {
        if (error && typeof error.code !== 'number') {
          reject(error)
          return
        }
        resolve({ exitCode: error?.code ?? 0, stdout, stderr })
      })
    })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}
