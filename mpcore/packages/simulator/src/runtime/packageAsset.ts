import { posix } from 'pathe'

const assetExtension = /\.(?:png|jpe?g|gif|svg|cer|mp3|aac|m4a|mp4|wav|ogg|silk|wasm|br|cur|ico|skel|crt|cert|gltf|glb|bin|ktx|hdr|exr|xnet|pem)$/i

/** 包内静态资源只读且每次访问宿主当前产物，不缓存为用户文件，也不允许越过包根目录。 */
export function createPackageAssetReader(read: (relativePath: string) => string | undefined) {
  return (filePath: string): string | undefined => {
    if (filePath.includes('\\') || filePath.includes(':') || filePath.includes('\0')) {
      return undefined
    }
    const relative = posix.normalize(filePath.replace(/^\/+/, ''))
    if (relative === '..' || relative.startsWith('../') || !assetExtension.test(relative)) {
      return undefined
    }
    return read(relative)
  }
}
