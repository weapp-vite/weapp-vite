import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// 通过预加载记录真正执行的脚手架版本，覆盖 pnpm dlx 缓存与镜像元数据漂移。
const receiptFile = process.env.CREATE_WEAPP_VITE_RECEIPT
const entry = process.argv[1]
if (receiptFile && entry && fs.existsSync(entry)) {
  let directory = path.dirname(fs.realpathSync(entry))
  while (true) {
    const manifestPath = path.join(directory, 'package.json')
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (manifest.name === 'create-weapp-vite') {
        fs.writeFileSync(receiptFile, JSON.stringify({ version: manifest.version, packageRoot: directory }))
        break
      }
    }
    const parent = path.dirname(directory)
    if (parent === directory) {
      break
    }
    directory = parent
  }
}
