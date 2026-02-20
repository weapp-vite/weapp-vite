import { UnifiedViteWeappTailwindcssPlugin } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite/config'
import fs from 'node:fs'
import path from 'node:path'

function collectWxsFiles(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) {
    return out
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectWxsFiles(absolutePath, out)
      continue
    }
    if (entry.isFile() && absolutePath.endsWith('.wxs')) {
      out.push(absolutePath)
    }
  }
  return out
}

function copyWxsSidecarPlugin(srcRoot = 'src') {
  const rootDir = process.cwd()
  let outDir = 'dist'

  const syncWxsFiles = () => {
    if (!rootDir) {
      return
    }
    const absoluteSrcRoot = path.resolve(rootDir, srcRoot)
    const absoluteOutDir = path.resolve(rootDir, outDir)
    const wxsFiles = collectWxsFiles(absoluteSrcRoot)
    for (const sourceFile of wxsFiles) {
      const relativePath = path.relative(absoluteSrcRoot, sourceFile)
      const targetFile = path.join(absoluteOutDir, relativePath)
      fs.mkdirSync(path.dirname(targetFile), { recursive: true })
      fs.copyFileSync(sourceFile, targetFile)
    }
  }

  return {
    name: 'retail-template:copy-wxs-sidecar',
    apply: 'build',
    configResolved(config: { build: { outDir?: string } }) {
      outDir = config.build.outDir || 'dist'
    },
    writeBundle() {
      syncWxsFiles()
    },
  }
}

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    // weapp-vite options
  },
  plugins: [
    UnifiedViteWeappTailwindcssPlugin({
      rem2rpx: true,
    }) as any,
    copyWxsSidecarPlugin('src'),
  ],
})
