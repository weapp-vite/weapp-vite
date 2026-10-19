import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 共享同一构建的契约套件使用跨平台进程启动器。
import { execa } from 'execa'
import { recordTiming } from '../../.github/scripts/ci-timing.mjs'

export const consumerContractGroups = {
  'react-host-paths': ['packages/weapp-vite/test/vite-react.test.ts'],
  'watch-validation': ['packages/weapp-vite/test/vite-watch-validation.test.ts', 'packages/weapp-vite/test/vite-watch.test.ts', 'packages/weapp-vite/test/vite-worker.test.ts', 'packages/weapp-vite/test/wxml-transform-watch.test.ts', 'packages/weapp-vite/src/vite/session.test.ts', 'packages/weapp-vite/src/runtime/buildPlugin/workers.test.ts'],
  'route-topology': ['packages/weapp-vite/src/plugins/core/lifecycle/autoRoutesTopology.test.ts', 'packages/weapp-vite/src/plugins/core/lifecycle/watch.test.ts', 'packages/weapp-vite/test/vite-watch.test.ts'],
  'host-paths': ['packages/weapp-vite/src/runtime/libDts.test.ts', 'packages/weapp-vite/src/runtime/compilerSession/session.test.ts', 'packages/weapp-vite/test/vite-lib.test.ts'],
  'native-path-controls': ['packages/weapp-vite/test/vite-native-path-controls.test.ts', 'packages/weapp-vite/test/vite-native-watch-topology.test.ts', 'packages/weapp-vite/src/plugins/tailwindcss/contentInvalidation.test.ts', 'packages/weapp-vite/src/runtime/statefulHmr/snapshotAssetInputs.test.ts'],
}

/** 同一 OS 共用初始化与构建，各组仍独立计时并保留首次失败的退出状态。 */
export async function runConsumerContracts() {
  for (const [name, files] of Object.entries(consumerContractGroups)) {
    await recordTiming('start', name)
    const result = await execa('pnpm', ['exec', 'vitest', 'run', ...files], { stdio: 'inherit', reject: false })
    await recordTiming('finish', name, result.exitCode)
    if (result.exitCode !== 0) {
      throw new Error(`Consumer contract failed: ${name} (${result.exitCode})`)
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runConsumerContracts()
}
