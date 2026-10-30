import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createTarballCommand } from '../createWeappViteSmoke/commands.mjs'
import { runCommand } from '../createWeappViteSmoke/process.mjs'
import { reportError } from '../createWeappViteSmoke/registry.mjs'
import { distHasRequiredOutputs } from '../createWeappViteSmoke/runtime.mjs'
import { assertPreparedProject, resolveMiniProgramDirectory } from '../createWeappViteSmoke/templates.mjs'
import { applyCandidateOverlay, inspectInstallation } from './artifacts.mjs'
import { managerCommand, qualityScripts, strictEnvironment } from './contracts.mjs'
import { nativeLanguagePublicApiDependencies, verifyNativeLanguages } from './languages.mjs'
import { verifyNativeBuilds } from './nativeBuilds.mjs'
import { prepareParentWorkspace, verifyWorkspaceInheritance } from './workspace.mjs'

/** 每阶段写独立日志；预期失败必须匹配指定规则诊断，不能把任意安装或执行错误当成通过。 */
export async function runStep(context, stage, invocation, expectedFailure, execute = runCommand) {
  const started = Date.now()
  let output = ''
  let error
  let exitCode = 0
  try {
    const result = await execute({ ...invocation, label: `${context.id}/${stage}`, timeoutMs: context.timeoutMs, quiet: true })
    output = `${result.stdout}\n${result.stderr}`
  }
  catch (reason) {
    error = reason
    output = reason instanceof Error ? reason.message : String(reason)
    const matched = /Command failed with code (\d+)/.exec(output)
    exitCode = matched ? Number(matched[1]) : null
  }
  const clean = reportError(new Error(output), context.privateRoots)
  const log = `${context.id.replaceAll('/', '-')}-${stage.replaceAll(':', '-')}.log`
  await fs.writeFile(path.join(context.reportRoot, log), clean)
  const matchedFailure = error && exitCode !== null && exitCode > 0 && (typeof expectedFailure === 'string' ? output.includes(expectedFailure) : expectedFailure?.test(output))
  const status = expectedFailure ? matchedFailure ? 'passed' : 'failed' : error ? 'failed' : 'passed'
  context.steps.push({ stage, status, exitCode, expectedFailure: Boolean(expectedFailure), durationMs: Date.now() - started, log })
  await context.flush()
  if (status !== 'passed') {
    throw error ?? new Error(`Expected diagnostic was not produced: ${stage}`)
  }
}

export async function runCase(testCase, options) {
  const { temporaryRoot, packageRoot, registry, artifacts, reportRoot, timeoutMs, flush } = options
  const root = path.join(temporaryRoot, testCase.id.replaceAll('/', '-'))
  const cacheRoot = path.join(temporaryRoot, 'cache')
  const env = strictEnvironment(registry, cacheRoot, options.env)
  const result = { ...testCase, steps: [], status: 'running' }
  const context = { id: testCase.id, reportRoot, timeoutMs, privateRoots: options.privateRoots, steps: result.steps, flush }
  options.report.results.push(result)
  const run = (stage, invocation, expectedFailure) => runStep(context, stage, { ...invocation, env }, expectedFailure)
  const generate = async (cwd, target, template, stage) => {
    const command = await createTarballCommand(packageRoot, target, template)
    command.args.push('--toolchain=vite-plus', '--dependency-versions=bundled')
    await run(stage, { ...command, cwd })
  }
  await fs.mkdir(root, { recursive: true })
  const project = path.join(root, testCase.workspace ? 'apps/mini' : 'app')
  try {
    if (testCase.workspace) {
      const seed = path.join(root, 'seed')
      await generate(root, 'seed', 'default', 'create-policy-source')
      const verifyParent = await prepareParentWorkspace(root, seed)
      await fs.rm(seed, { recursive: true })
      await generate(root, 'apps/mini', testCase.template, 'create')
      await verifyParent()
      result.parentPreserved = true
    }
    else {
      await generate(root, 'app', testCase.template, 'create')
    }
    const manifest = JSON.parse(await fs.readFile(path.join(project, 'package.json'), 'utf8'))
    const scripts = qualityScripts(manifest)
    if (testCase.platforms) {
      assert.equal(manifest.scripts.dev, 'vp dev --config vite.weapp.config.ts')
      assert.equal(manifest.scripts.build, 'vp build --config vite.weapp.config.ts')
    }
    else {
      assert.equal(manifest.scripts.dev, 'vp dev')
      assert.equal(manifest.scripts.build, 'vp build')
    }
    const installRoot = testCase.workspace ? root : project
    const fixtureDependencies = testCase.platforms ? nativeLanguagePublicApiDependencies : []
    const restore = await applyCandidateOverlay(installRoot, testCase.manager, artifacts, { directDependencies: fixtureDependencies })
    try {
      const args = testCase.manager === 'npm' ? ['install', '--strict-peer-deps', '--no-audit', '--no-fund'] : ['install']
      await run('install', { ...managerCommand(testCase.manager, args, registry, cacheRoot), cwd: installRoot })
      result.installation = await inspectInstallation(installRoot, artifacts, testCase.manager)
      if (fixtureDependencies.length) {
        result.fixtureDependencies = fixtureDependencies
      }
    }
    finally {
      await restore()
    }
    await assertPreparedProject(project)
    result.prepared = true
    const runScript = (script, stage = script, expectedFailure) => run(stage, {
      ...managerCommand(testCase.manager, ['run', script], registry, cacheRoot),
      cwd: project,
    }, expectedFailure)
    for (const script of scripts) {
      await runScript(script)
    }
    if (testCase.platforms) {
      const runTool = (stage, args) => run(stage, { ...managerCommand(testCase.manager, args, registry, cacheRoot), cwd: project })
      result.nativeLanguages = await verifyNativeLanguages(
        project,
        runScript,
        () => runTool('native-language-stylelint', ['exec', 'stylelint', 'language-fixtures/**/*.{css,wxss,acss,ttss,qss,jxss,tyss}']),
        args => runTool('native-language-public-types', args),
      )
      result.nativeBuilds = await verifyNativeBuilds(project, runTool)
      result.platforms = []
      for (const platform of testCase.platforms) {
        await runScript(`build:${platform}`)
        const output = await resolveMiniProgramDirectory(project, testCase.template, platform)
        assert(output, `Missing ${platform} IDE project configuration`)
        for (const file of ['app.json', 'app.js']) {
          assert((await fs.stat(path.join(output, file))).isFile(), `Missing ${platform} ${file}`)
        }
        result.platforms.push(platform)
      }
    }
    assert(await distHasRequiredOutputs(project, testCase.template), 'Missing built app.json or app.js')
    result.builtOutputs = true
    if (testCase.workspace) {
      await verifyWorkspaceInheritance(root, project, runScript)
      result.workspaceInheritance = { lint: true, fmt: true }
    }
    result.status = 'passed'
  }
  catch (error) {
    result.status = 'failed'
    result.error = reportError(error, options.privateRoots)
  }
  finally {
    await flush()
  }
  return result.status === 'passed'
}
