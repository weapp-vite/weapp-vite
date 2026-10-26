import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 跨平台解析 pnpm shim，并保留文件名的独立 argv 边界。
import { execaSync } from 'execa'

// Git commit 和 git merge 分别传入 COMMIT_EDITMSG / MERGE_MSG，不能猜测消息文件。
const message = process.argv[2]
if (!message || message === '{1}') {
  throw new Error('commit-msg requires the message file supplied by Git')
}
execaSync('pnpm', ['exec', 'repo', 'verify', 'commit-msg', path.resolve(message)], { stdio: 'inherit', preferLocal: true })
