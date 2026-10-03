import type { ConsumerRuntimeObservation } from './consumerRuntime'
import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { exec } from 'tinyexec'
import { loadConsumerRuntime, verifyConsumerRuntime } from './consumerRuntime'

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
  const runtimeArguments = process.argv.slice(3).filter(argument => argument.startsWith('--runtime'))
  if (runtimeArguments.length > 1 || runtimeArguments.some(argument => argument !== '--runtime=headless')) {
    throw new Error('The only supported runtime option is --runtime=headless; omit it for historical build-only verification.')
  }
  const runtimeMode = runtimeArguments.length > 0 ? 'headless' : undefined
  if (!directory || !process.argv.includes('--disposable-consumer')) {
    throw new Error('Usage: node --import tsx scripts/runtime-size/verifyConsumer.ts <installed consumer> --disposable-consumer [--runtime=headless]')
  }
  const root = await realpath(path.resolve(directory))
  const runtime = runtimeMode === 'headless' ? await loadConsumerRuntime(root) : undefined
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
  await rm(path.join(output, 'verification.json'), { force: true })
  const runtimeObservations: ConsumerRuntimeObservation[] = []
  const verification: Record<string, unknown> = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    status: 'in-progress',
    runtimeValidation: runtime ? 'headless-pending' : 'not-run-build-and-attribution-only',
    ...(runtime ? { runtimePackage: runtime.package, runtimeObservations, scenarioAdaptations: ['typical counter uses a native button for role-based headless interaction'] } : {}),
    stableDevtoolsValidation: 'not-run-final-runtime-acceptance-incomplete',
  }
  const saveVerification = () => writeFile(path.join(output, 'verification.json'), `${JSON.stringify(verification, null, 2)}\n`)
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
    verification.instrumentationPreservesEveryArtifact = true
    verification.uninstrumentedFiles = baseline
    await rename(path.join(root, 'consumer-attribution.json'), path.join(output, 'benchmark.json'))
    const appSource = '<script setup>\ndefineAppJson({ pages: ["pages/index/index"] })\n</script>\n'
    const counterTag = runtime ? 'button' : 'view'
    const scenarios = {
      minimal: '<template><view>minimal published consumer</view></template>\n',
      typical: `<script setup>\nimport { ref, computed, onLoad } from "wevu"\nconst count = ref(0)\nconst doubled = computed(() => count.value * 2)\nonLoad(() => { count.value = 1 })\nfunction increment() { count.value++ }\n</script>\n<template><${counterTag} @tap="increment">{{ count }} / {{ doubled }}</${counterTag}></template>\n`,
    }
    verification.scenarioSource = { app: appSource, ...scenarios }
    await saveVerification()
    for (const name of ['minimal', 'typical'] as const) {
      const source = scenarios[name]
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
      if (runtime) {
        runtimeObservations.push(await verifyConsumerRuntime(root, name, runtime))
        await saveVerification()
      }
    }
    verification.status = 'passed'
    verification.runtimeValidation = runtime ? 'headless-passed-stable-devtools-not-run' : 'not-run-build-and-attribution-only'
    await saveVerification()
    process.stdout.write('Published consumer benchmark, minimal and typical builds passed; instrumentation preserved every emitted file.\n')
    process.stdout.write(runtime
      ? `Headless observations: ${JSON.stringify(runtimeObservations)}\nReal Stable WeChat DevTools validation was not run; final runtime acceptance is incomplete.\n`
      : 'Runtime behavior is not asserted in build-only mode. Real Stable WeChat DevTools validation was not run; final runtime acceptance is incomplete.\n')
  }
  catch (error) {
    verification.status = 'failed'
    verification.runtimeValidation = runtime ? 'headless-not-completed' : 'not-run-build-and-attribution-only'
    verification.failure = (error instanceof Error ? error.message : String(error)).replaceAll(root, '[consumer]')
    await saveVerification()
    throw error
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
