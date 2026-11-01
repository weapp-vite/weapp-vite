import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createPublishManifest } from './release-vsce'
import {
  ensureVscodeUserSettings,
} from './vscode-e2e-shared'

/** 宿主使用正式扩展身份及发布白名单，不改动工作区的默认格式器配置。 */
export async function prepareHostSmokeExtension(extensionRoot: string, userDataDir: string) {
  const source: unknown = JSON.parse(await fs.readFile(path.join(extensionRoot, 'package.json'), 'utf8'))
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('扩展 package.json 必须为对象')
  }
  const manifest: Record<string, unknown> = createPublishManifest(source as Record<string, unknown>)
  const files = manifest.files
  if (typeof manifest.publisher !== 'string' || typeof manifest.name !== 'string' || typeof manifest.main !== 'string'
    || !Array.isArray(files) || files.some(file => typeof file !== 'string')) {
    throw new Error('宿主 smoke 需要完整的扩展身份、入口和发布文件白名单')
  }

  const extensionDevelopmentPath = path.join(userDataDir, 'extension')
  await fs.mkdir(extensionDevelopmentPath, { recursive: true })
  for await (const relative of fs.glob(files as string[], { cwd: extensionRoot })) {
    const sourcePath = path.join(extensionRoot, relative)
    if (!(await fs.stat(sourcePath)).isFile()) {
      continue
    }
    const destination = path.join(extensionDevelopmentPath, relative)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(sourcePath, destination)
  }
  await fs.writeFile(path.join(extensionDevelopmentPath, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await fs.access(path.join(extensionDevelopmentPath, manifest.main))
  return { extensionDevelopmentPath, extensionId: `${manifest.publisher}.${manifest.name}` }
}

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
    const { extensionDevelopmentPath, extensionId } = await prepareHostSmokeExtension(extensionRoot, userDataDir)
    await ensureVscodeUserSettings(userDataDir)
    const { runTests } = await resolveVscodeTestElectron()
    const vscodeExecutablePath = process.env.VSCODE_EXECUTABLE_PATH

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath: runnerPath,
      extensionTestsEnv: { WEAPP_VITE_VSCODE_HOST_EXTENSION_ID: extensionId },
      ...(vscodeExecutablePath ? { vscodeExecutablePath } : {}),
      launchArgs: [
        fixturePath,
        `--user-data-dir=${userDataDir}`,
        '--disable-extensions',
        '--disable-workspace-trust',
        '--skip-welcome',
        '--skip-release-notes',
      ],
    })
  }
  finally {
    await fs.rm(userDataDir, { force: true, recursive: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main()
}
