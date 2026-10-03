import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { exec } from 'tinyexec'

async function inventory(directory: string, prefix = ''): Promise<Array<{ file: string, bytes: number, sha256: string }>> {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await inventory(filename, relative))
    }
    else if (entry.isFile()) {
      const content = await readFile(filename)
      files.push({ file: relative, bytes: content.byteLength, sha256: createHash('sha256').update(content).digest('hex') })
    }
  }
  return files.sort((left, right) => left.file.localeCompare(right.file))
}

async function main() {
  const directory = process.argv[2]
  if (!directory || !process.argv.includes('--disposable-consumer')) {
    throw new Error('Usage: node --import tsx scripts/runtime-size/verifyConsumer.ts <installed consumer> --disposable-consumer')
  }
  const root = await realpath(path.resolve(directory))
  const configFile = path.join(root, 'weapp-vite.config.ts')
  const originalConfig = await readFile(configFile, 'utf8')
  if (!originalConfig.includes('defineConfig(() => ({') || originalConfig.includes('captureConsumerAttribution')) {
    throw new Error('Expected the unmodified benchmark consumer configuration.')
  }
  const lockfile = await stat(path.join(root, 'pnpm-lock.yaml')).then(() => 'pnpm-lock.yaml', () => 'package-lock.json')
  const output = path.join(root, 'runtime-attribution-evidence')
  const backup = path.join(root, 'runtime-attribution-source-backup')
  await mkdir(backup)
  await cp(path.join(root, 'src'), path.join(backup, 'src'), { recursive: true })
  await mkdir(output, { recursive: true })
  const run = async () => {
    const result = await exec(process.execPath, [path.join(root, 'node_modules/weapp-vite/bin/weapp-vite.js'), 'build'], {
      nodeOptions: { cwd: root, env: { ...process.env, RUNTIME_ATTRIBUTION_LOCKFILE: lockfile } },
      timeout: 120_000,
      throwOnError: false,
    })
    process.stderr.write(result.stderr)
    if (result.exitCode !== 0) {
      process.stderr.write(result.stdout)
      throw new Error(`Consumer build failed (${result.exitCode}).`)
    }
  }
  try {
    await run()
    const baseline = await inventory(path.join(root, 'dist'))
    await build({ entryPoints: [fileURLToPath(new URL('./consumerCapture.ts', import.meta.url))], outfile: path.join(root, 'attribution-capture.mjs'), bundle: true, platform: 'node', format: 'esm' })
    await writeFile(configFile, `import { captureConsumerAttribution } from './attribution-capture.mjs'\n${originalConfig.replace('defineConfig(() => ({', 'defineConfig(() => ({\n  plugins: [captureConsumerAttribution()],')}`)
    await run()
    const instrumented = await inventory(path.join(root, 'dist'))
    if (JSON.stringify(baseline) !== JSON.stringify(instrumented)) {
      throw new Error('Attribution instrumentation changed emitted artifacts.')
    }
    await rename(path.join(root, 'consumer-attribution.json'), path.join(output, 'benchmark.json'))
    const appSource = '<script setup>\ndefineAppJson({ pages: ["pages/index/index"] })\n</script>\n'
    const scenarios = {
      minimal: '<template><view>minimal published consumer</view></template>\n',
      typical: '<script setup>\nimport { ref, computed, onLoad } from "wevu"\nconst count = ref(0)\nconst doubled = computed(() => count.value * 2)\nonLoad(() => { count.value = 1 })\nfunction increment() { count.value++ }\n</script>\n<template><view @tap="increment">{{ count }} / {{ doubled }}</view></template>\n',
    }
    for (const [name, source] of Object.entries(scenarios)) {
      await rm(path.join(root, 'src'), { recursive: true })
      await mkdir(path.join(root, 'src/pages/index'), { recursive: true })
      await writeFile(path.join(root, 'src/app.vue'), appSource)
      await writeFile(path.join(root, 'src/pages/index/index.vue'), source)
      await run()
      for (const extension of ['js', 'json', 'wxml']) {
        const filename = path.join(root, 'dist/pages/index', `index.${extension}`)
        if (!(await stat(filename)).isFile()) {
          throw new Error(`Missing published-consumer page: ${extension}`)
        }
      }
      await rename(path.join(root, 'consumer-attribution.json'), path.join(output, `${name}.json`))
    }
    await writeFile(path.join(output, 'verification.json'), `${JSON.stringify({ schemaVersion: 1, instrumentationPreservesEveryArtifact: true, uninstrumentedFiles: baseline, scenarioSource: { app: appSource, ...scenarios }, runtimeValidation: 'not-run-build-and-attribution-only' }, null, 2)}\n`)
    process.stdout.write('Published consumer benchmark, minimal and typical builds passed; instrumentation preserved every emitted file. Runtime behavior is not asserted by this command.\n')
  }
  finally {
    await writeFile(configFile, originalConfig)
    await rm(path.join(root, 'src'), { recursive: true, force: true })
    await rename(path.join(backup, 'src'), path.join(root, 'src'))
    await rm(backup, { recursive: true })
    await rm(path.join(root, 'attribution-capture.mjs'), { force: true })
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
