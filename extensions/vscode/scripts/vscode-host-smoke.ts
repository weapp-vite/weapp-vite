import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import {
  ensureVscodeUserSettings,
} from './vscode-e2e-shared'

async function resolveVscodeTestElectron() {
  const moduleName = '@vscode/test-electron'

  try {
    return await import(moduleName)
  }
  catch (error) {
    throw new Error([
      '缺少 @vscode/test-electron，暂时无法运行真实 VS Code 宿主 smoke 测试。',
      '请先在仓库根目录安装该依赖后再执行：pnpm --dir extensions/vscode run test:host:smoke',
      `原始错误: ${error instanceof Error ? error.message : String(error)}`,
    ].join('\n'))
  }
}

async function main() {
  const extensionRoot = path.resolve(process.cwd())
  const fixturePath = path.join(extensionRoot, 'scripts', 'fixtures', 'vscode-host-smoke')
  const distEntryPath = path.join(extensionRoot, 'dist', 'extension.js')
  const runnerPath = path.join(extensionRoot, 'scripts', 'vscode-host-smoke-runner.cjs')
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-vscode-host-smoke-'))

  try {
    await fs.access(distEntryPath)
    await fs.access(runnerPath)
    await ensureVscodeUserSettings(userDataDir)
    const { runTests } = await resolveVscodeTestElectron()

    await runTests({
      extensionDevelopmentPath: extensionRoot,
      extensionTestsPath: runnerPath,
      launchArgs: [
        fixturePath,
        '--disable-extensions',
        '--disable-workspace-trust',
        '--skip-welcome',
        '--skip-release-notes',
      ],
      userDataDir,
    })
  }
  finally {
    await fs.rm(userDataDir, { force: true, recursive: true })
  }
}

void main()
