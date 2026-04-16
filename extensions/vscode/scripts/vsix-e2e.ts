import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

async function resolveVscodeTestElectron() {
  const moduleName = '@vscode/test-electron'

  try {
    return await import(moduleName)
  }
  catch (error) {
    throw new Error([
      '缺少 @vscode/test-electron，暂时无法运行 `.vsix` 安装态 e2e。',
      '请先在仓库根目录安装该依赖后再执行：pnpm --dir extensions/vscode run test:vsix:e2e',
      `原始错误: ${error instanceof Error ? error.message : String(error)}`,
    ].join('\n'))
  }
}

async function main() {
  const extensionRoot = path.resolve(process.cwd())
  const fixturePath = path.join(extensionRoot, 'scripts', 'fixtures', 'vscode-host-smoke')
  const harnessPath = path.join(extensionRoot, 'scripts', 'fixtures', 'vscode-vsix-test-harness')
  const runnerPath = path.join(extensionRoot, 'scripts', 'vsix-e2e-runner.cjs')
  const vsixPath = path.join(extensionRoot, '.artifacts', 'weapp-vite.vsix')
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-vscode-vsix-user-'))
  const extensionsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-vscode-vsix-exts-'))

  try {
    await fs.access(vsixPath)
    await fs.access(runnerPath)
    await fs.access(path.join(harnessPath, 'package.json'))
    await fs.access(path.join(harnessPath, 'extension.js'))
    const {
      downloadAndUnzipVSCode,
      resolveCliArgsFromVSCodeExecutablePath,
      runTests,
    } = await resolveVscodeTestElectron()
    const vscodeExecutablePath = await downloadAndUnzipVSCode()
    const [cliPath, ...cliBaseArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath, {
      reuseMachineInstall: true,
    })
    const installResult = spawnSync(
      cliPath,
      [
        ...cliBaseArgs,
        `--extensions-dir=${extensionsDir}`,
        `--user-data-dir=${userDataDir}`,
        '--install-extension',
        vsixPath,
      ],
      {
        shell: process.platform === 'win32',
        stdio: 'inherit',
      },
    )

    if (installResult.status !== 0) {
      process.exit(installResult.status ?? 1)
    }

    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath: harnessPath,
      extensionTestsPath: runnerPath,
      extensionTestsEnv: {
        WEAPP_VITE_VSIX_ID: 'weapp-vite.weapp-vite',
      },
      launchArgs: [
        fixturePath,
        `--extensions-dir=${extensionsDir}`,
        `--user-data-dir=${userDataDir}`,
        '--skip-welcome',
        '--skip-release-notes',
      ],
    })
  }
  finally {
    await fs.rm(userDataDir, { force: true, recursive: true })
    await fs.rm(extensionsDir, { force: true, recursive: true })
  }
}

void main()
