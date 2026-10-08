import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export async function readHostDependencyOverrides(hostManifest) {
  const postcss = JSON.parse(await readFile(fileURLToPath(import.meta.resolve('postcss/package.json')), 'utf8'))
  // 私有宿主对齐编译器和插件的类型身份；不依赖上游旧锁文件，也不向公共包添加 override。
  return { rolldown: hostManifest.dependencies.rolldown, postcss: postcss.version }
}
