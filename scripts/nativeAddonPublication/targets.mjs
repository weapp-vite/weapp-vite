import process from 'node:process'

export const nativeTargets = Object.freeze([
  {
    id: 'darwin-arm64',
    packageName: '@weapp-vite/ast-native-darwin-arm64',
    packageDirectory: 'packages/ast-native-darwin-arm64',
    platform: 'darwin',
    arch: 'arm64',
    rustTarget: 'aarch64-apple-darwin',
    binaryName: 'weapp_vite_ast_native.darwin-arm64.node',
  },
  {
    id: 'darwin-x64',
    packageName: '@weapp-vite/ast-native-darwin-x64',
    packageDirectory: 'packages/ast-native-darwin-x64',
    platform: 'darwin',
    arch: 'x64',
    rustTarget: 'x86_64-apple-darwin',
    binaryName: 'weapp_vite_ast_native.darwin-x64.node',
  },
  {
    id: 'linux-arm64-gnu',
    packageName: '@weapp-vite/ast-native-linux-arm64-gnu',
    packageDirectory: 'packages/ast-native-linux-arm64-gnu',
    platform: 'linux',
    arch: 'arm64',
    libc: 'glibc',
    rustTarget: 'aarch64-unknown-linux-gnu',
    binaryName: 'weapp_vite_ast_native.linux-arm64-gnu.node',
  },
  {
    id: 'linux-x64-gnu',
    packageName: '@weapp-vite/ast-native-linux-x64-gnu',
    packageDirectory: 'packages/ast-native-linux-x64-gnu',
    platform: 'linux',
    arch: 'x64',
    libc: 'glibc',
    rustTarget: 'x86_64-unknown-linux-gnu',
    binaryName: 'weapp_vite_ast_native.linux-x64-gnu.node',
  },
  {
    id: 'win32-arm64-msvc',
    packageName: '@weapp-vite/ast-native-win32-arm64-msvc',
    packageDirectory: 'packages/ast-native-win32-arm64-msvc',
    platform: 'win32',
    arch: 'arm64',
    rustTarget: 'aarch64-pc-windows-msvc',
    binaryName: 'weapp_vite_ast_native.win32-arm64-msvc.node',
  },
  {
    id: 'win32-x64-msvc',
    packageName: '@weapp-vite/ast-native-win32-x64-msvc',
    packageDirectory: 'packages/ast-native-win32-x64-msvc',
    platform: 'win32',
    arch: 'x64',
    rustTarget: 'x86_64-pc-windows-msvc',
    binaryName: 'weapp_vite_ast_native.win32-x64-msvc.node',
  },
])

const targetsById = new Map(nativeTargets.map(target => [target.id, target]))
const targetsByRuntime = new Map(nativeTargets.map(target => [`${target.platform}:${target.arch}`, target]))

export function getNativeTarget(id) {
  const target = targetsById.get(id)
  if (!target) {
    throw new Error(`Unknown @weapp-vite/ast-native target: ${id}`)
  }
  return target
}

function runtimeLibc() {
  return process.report?.getReport?.().header?.glibcVersionRuntime ? 'glibc' : 'musl-or-unknown-libc'
}

export function getNativeTargetForRuntime(platform = process.platform, arch = process.arch, libc = runtimeLibc()) {
  if (platform === 'linux' && libc !== 'glibc') {
    throw new Error(`Unsupported @weapp-vite/ast-native platform: linux:${arch}:${libc}`)
  }
  const target = targetsByRuntime.get(`${platform}:${arch}`)
  if (!target) {
    throw new Error(`Unsupported @weapp-vite/ast-native platform: ${platform}:${arch}`)
  }
  return target
}

export function packageManifestForTarget(target, version) {
  return {
    name: target.packageName,
    version,
    description: `Native @weapp-vite/ast-native binding for ${target.id}`,
    main: `./${target.binaryName}`,
    files: [target.binaryName],
    os: [target.platform],
    cpu: [target.arch],
    ...(target.libc ? { libc: [target.libc] } : {}),
    license: 'MIT',
    homepage: 'https://github.com/weapp-vite/weapp-vite#readme',
    repository: {
      type: 'git',
      url: 'git+https://github.com/weapp-vite/weapp-vite.git',
      directory: target.packageDirectory,
    },
    publishConfig: {
      access: 'public',
      registry: 'https://registry.npmjs.org',
    },
  }
}
