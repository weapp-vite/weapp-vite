import type { WindowsKernelArtifactManifest } from '../../e2e/utils/devProcessCleanup/windowsKernelArtifact'
import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 私用 E2E 工具显式编译，持有精确子进程并等待排空。
import { execa } from 'execa'
import { createSuiteSignalScope } from '../../e2e/scripts/suiteRunner/signals'
import { observeWindowsCompilerChild } from '../../e2e/utils/devProcessCleanup/windowsCompilerChildTrace'
import { withWindowsInspectorDirectory } from '../../e2e/utils/devProcessCleanup/windowsInspectorOperation'
import { readWindowsKernelInspector, WINDOWS_KERNEL_COMPILE_TIMEOUT_MS, WINDOWS_KERNEL_COMPILER_FLAGS, WINDOWS_KERNEL_SOURCE, WINDOWS_KERNEL_TOOL_ROOT, WINDOWS_KERNEL_WORKSPACE, windowsKernelDigest } from '../../e2e/utils/devProcessCleanup/windowsKernelArtifact'
import { WINDOWS_PROCESS_ROWS_HEADER } from '../../e2e/utils/devProcessCleanup/windowsProcessRows'
import { runWithCleanup } from '../../e2e/utils/runWithCleanup'

async function outputDirectory(root: string): Promise<string> {
  const workspace = await fs.realpath(root)
  let directory = workspace
  for (const part of WINDOWS_KERNEL_TOOL_ROOT.split('/')) {
    directory = join(directory, part)
    await fs.mkdir(directory).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
    })
    const actual = await fs.realpath(directory)
    const within = relative(workspace, actual)
    if (isAbsolute(within) || within === '..' || within.startsWith(`..${sep}`) || !(await fs.stat(actual)).isDirectory()) {
      throw new Error('Windows kernel inspector build output escapes its workspace.')
    }
    directory = actual
  }
  return directory
}

/** 显式构建一次私用检查器；运行时不得编译、探测执行或隐式复用旧构建。 */
export async function buildWindowsKernelInspector(root = WINDOWS_KERNEL_WORKSPACE, env = process.env, signal?: AbortSignal): Promise<void> {
  if (process.platform !== 'win32') {
    return
  }
  const keys = Object.keys(env)
  const systemRootKey = keys.find(key => key.toLowerCase() === 'systemroot')
  const windirKey = keys.find(key => key.toLowerCase() === 'windir')
  const windowsRoot = (systemRootKey && env[systemRootKey]) || (windirKey && env[windirKey])
  if (!windowsRoot || !isAbsolute(windowsRoot)) {
    throw new Error('Windows kernel inspection requires an absolute Windows system directory.')
  }
  const compilerPath = `Microsoft.NET/${process.arch === 'ia32' ? 'Framework' : 'Framework64'}/v4.0.30319/csc.exe`
  const compiler = join(windowsRoot, compilerPath)
  const source = await fs.readFile(join(root, WINDOWS_KERNEL_SOURCE))
  if (!source.toString().includes(`private const string Header = "${WINDOWS_PROCESS_ROWS_HEADER}";`)) {
    throw new Error('Windows kernel inspector source and parser wire contract disagree.')
  }
  const commit = env.BUILD_ARTIFACT_EXPECTED_COMMIT ?? env.GITHUB_SHA
    ?? (await execa('git', ['rev-parse', 'HEAD'], { cwd: root, timeout: 3_000, stdin: 'ignore', cancelSignal: signal })).stdout.trim()
  const output = await outputDirectory(root)
  // 清除的只有本工具固定产物；编译失败不能留下可被误认为本轮成功的旧 manifest。
  const lock = await fs.open(join(output, 'build.lock'), 'wx')
  await runWithCleanup(async () => {
    await fs.rm(join(output, 'manifest.json'), { force: true })
    await withWindowsInspectorDirectory(async (directory, settle) => {
      const executable = join(directory, 'snapshot.exe')
      const compilationSource = join(directory, 'snapshot.cs')
      await fs.writeFile(compilationSource, source)
      signal?.throwIfAborted()
      const startedMs = performance.now()
      const dispatchedAt = new Date().toISOString()
      const subprocess = execa(compiler, [...WINDOWS_KERNEL_COMPILER_FLAGS, `/out:${executable}`, compilationSource], {
        stdin: 'ignore',
        timeout: WINDOWS_KERNEL_COMPILE_TIMEOUT_MS,
        reject: false,
        windowsHide: true,
        cancelSignal: signal,
      })
      const observation = observeWindowsCompilerChild(subprocess, startedMs)
      let settlement: ReturnType<typeof observation.snapshot> | undefined
      const observed = Object.assign(subprocess.then((result) => {
        settlement = observation.snapshot()
        return result
      }, (error: unknown) => {
        settlement = observation.snapshot()
        throw error
      }), { nodeChildProcess: subprocess.nodeChildProcess })
      const compilationFailure = (message: string, cause: unknown) => {
        const drain = observation.snapshot()
        const inputs = {
          dispatchedAt,
          observedAt: new Date().toISOString(),
          sourceSha256: windowsKernelDigest(source),
          flagsSha256: windowsKernelDigest(JSON.stringify(WINDOWS_KERNEL_COMPILER_FLAGS)),
          compilerRelativePath: compilerPath,
          timeoutMs: WINDOWS_KERNEL_COMPILE_TIMEOUT_MS,
          node: process.version,
          arch: process.arch,
          nativeCloseConfirmed: drain.phase === 'closed',
          ownerCancelled: signal?.aborted ?? false,
        }
        return new Error(`${message}, child=${JSON.stringify(settlement ?? drain)}, drain=${JSON.stringify(drain)}, inputs=${JSON.stringify(inputs)}.`, { cause })
      }
      try {
        const result = await settle(observed).catch((cause: unknown) => {
          throw compilationFailure('Windows kernel inspector compilation rejected', cause)
        })
        if (result.exitCode !== 0) {
          throw compilationFailure(`Windows kernel inspector compilation failed: exitCode=${result.exitCode ?? 'none'}, signal=${result.signal ?? 'none'}, timedOut=${result.timedOut ?? false}`, result)
        }
        signal?.throwIfAborted()
        const manifest: WindowsKernelArtifactManifest = {
          schemaVersion: 1,
          tool: 'windows-kernel-inspector',
          logicalRoot: 'workspace',
          source: { path: WINDOWS_KERNEL_SOURCE, sha256: windowsKernelDigest(source) },
          flags: WINDOWS_KERNEL_COMPILER_FLAGS,
          flagsSha256: windowsKernelDigest(JSON.stringify(WINDOWS_KERNEL_COMPILER_FLAGS)),
          wire: WINDOWS_PROCESS_ROWS_HEADER,
          imageSha256: windowsKernelDigest(await fs.readFile(executable)),
          compiler: { relativePath: compilerPath, sha256: windowsKernelDigest(await fs.readFile(compiler)) },
          provenance: { commit, runId: env.GITHUB_RUN_ID ?? null, runAttempt: env.GITHUB_RUN_ATTEMPT ?? null, os: process.platform, arch: process.arch, node: process.version },
        }
        // 可执行文件由 csc 原生输出；发布其原始文件，不手写 bundle 或二进制。
        signal?.throwIfAborted()
        const publishedImage = join(output, 'snapshot.exe')
        await fs.rm(publishedImage, { force: true })
        await fs.copyFile(executable, publishedImage, constants.COPYFILE_EXCL)
        signal?.throwIfAborted()
        await fs.writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
        readWindowsKernelInspector(root, env)
      }
      finally {
        observation.dispose()
      }
    })
  }, () => runWithCleanup(() => lock.close(), () => fs.rm(join(output, 'build.lock'), { force: true })))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.platform !== 'win32') {
    process.stdout.write('Windows E2E native tools: non-applicable on this platform.\n')
  }
  else if (process.argv.slice(2).filter(argument => argument !== '--').includes('--check')) {
    readWindowsKernelInspector()
    process.stdout.write('Windows E2E native tools: verified without compilation.\n')
  }
  else {
    const scope = createSuiteSignalScope()
    try {
      await buildWindowsKernelInspector(WINDOWS_KERNEL_WORKSPACE, process.env, scope.signal)
      process.stdout.write('Windows E2E native tools: explicit build completed.\n')
    }
    finally {
      process.exitCode = scope.exitCode ?? process.exitCode
      scope.dispose()
    }
  }
}
