import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 复用跨平台命令解析，确保 Windows 的 pnpm.cmd 与 Unix 入口一致。
import { execa } from 'execa'
import { verifyDocsArtifacts } from './verify.mjs'

// 网站本身始终直接构建，Markdown 与渠道上下文不会复用旧的 Turbo 站点产物。
await execa('pnpm', ['exec', 'turbo', 'run', 'build', '--filter=website-weapp-vite^...'], { stdio: 'inherit' })
await execa('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], { stdio: 'inherit' })
await execa('pnpm', ['--filter', 'website-weapp-vite', 'test'], { stdio: 'inherit' })
await execa('pnpm', ['--filter', 'website-weapp-vite', 'build'], { stdio: 'inherit' })
await verifyDocsArtifacts('website/dist', process.env.REPO_DOCS_CHANNEL || 'preview')
