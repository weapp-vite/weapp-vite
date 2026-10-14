import { fileURLToPath } from 'node:url'

// 真实传输集成测试显式使用 Dashboard 自己的安装闭包，不借用核心包的开发依赖。
export const dashboardTransportPackageJsonPath = fileURLToPath(new URL('../../../../../dashboard/package.json', import.meta.url))
