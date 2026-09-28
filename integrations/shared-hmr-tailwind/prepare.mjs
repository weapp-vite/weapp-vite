import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 保留跨平台进程启动、流式输出与终止能力。
import { execa } from 'execa'
import YAML from 'yaml'

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const workspace = path.resolve(here, '../..')
  const destination = path.join(workspace, '.tmp/shared-hosts')
  const packages = path.join(destination, 'packages')
  const sources = JSON.parse(await readFile(path.join(here, 'sources.json'), 'utf8'))

  async function command(cwd, program, args) {
    await execa(program, args, { cwd, stdio: 'inherit' })
  }

  async function checkout(name) {
    const spec = sources[name]
    const directory = path.join(destination, name)
    // 只创建新的检验目录，不覆盖用户现有 clone 或修改。
    await command(destination, 'git', ['clone', '--filter=blob:none', '--no-checkout', spec.repository, directory])
    await command(directory, 'git', ['checkout', '--detach', spec.revision])
    await command(directory, 'git', ['apply', '--check', path.join(here, `${name}.patch`)])
    await command(directory, 'git', ['apply', path.join(here, `${name}.patch`)])
    return directory
  }

  async function pack(repository, directory) {
    const manifest = JSON.parse(await readFile(path.join(repository, directory, 'package.json'), 'utf8'))
    await command(repository, 'pnpm', ['--filter', manifest.name, 'pack', '--pack-destination', packages])
    const original = path.join(packages, `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`)
    const digest = createHash('sha256').update(await readFile(original)).digest('hex')
    const captured = original.replace(/\.tgz$/, `-${digest.slice(0, 12)}.tgz`)
    await rename(original, captured)
    return { name: manifest.name, file: captured, sha256: digest }
  }

  await mkdir(packages, { recursive: true })
  const core = await checkout('tailwind-core')
  const taro = await checkout('taro')
  await command(core, 'pnpm', ['install', '--frozen-lockfile', '--ignore-scripts', '--filter', 'weapp-tailwindcss...'])
  await command(core, 'pnpm', ['--filter', 'weapp-tailwindcss...', 'build'])
  await command(workspace, 'pnpm', ['--filter', '@weapp-vite/hmr', '--filter', '@weapp-vite/tailwindcss', 'build'])
  const artifacts = []
  for (const [repository, directory] of [
    [core, 'packages/postcss'],
    [core, 'packages/weapp-tailwindcss'],
    [workspace, 'packages/hmr'],
    [workspace, 'packages/tailwindcss'],
  ]) {
    artifacts.push(await pack(repository, directory))
  }
  const configFile = path.join(taro, 'pnpm-workspace.yaml')
  const config = YAML.parse(await readFile(configFile, 'utf8'))
  for (const artifact of artifacts) {
    config.overrides[artifact.name] = `file:${path.relative(taro, artifact.file).replaceAll('\\', '/')}`
  }
  await writeFile(configFile, YAML.stringify(config))
  await command(taro, 'pnpm', ['install', '--ignore-scripts'])
  await command(taro, 'pnpm', ['prepare:taro'])
  await command(taro, 'pnpm', ['--filter', 'vite-plugin-taro', 'typecheck'])
  await writeFile(path.join(destination, 'artifacts.json'), `${JSON.stringify({
    sources,
    artifacts: artifacts.map(artifact => ({ ...artifact, file: path.relative(destination, artifact.file).replaceAll('\\', '/') })),
  }, null, 2)}\n`)
  process.stdout.write('双宿主集成依赖已准备；E2E 必须另行检查全机进程后串行启动。\n')
}

void main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
