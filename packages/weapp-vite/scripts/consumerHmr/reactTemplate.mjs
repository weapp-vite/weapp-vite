import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertConsumerClassicSession } from './startupClassic.mjs'

/** React 静态模板越过 patch-shape 边界后，更新与恢复均由同一 classic 会话发布。 */
export async function verifyReactTemplateHmr({ root, operation, original, waitForOutput, waitForWatchRound, waitForClassicReady, readOutput }) {
  for (const [index, label] of ['React host updated template', 'weapp-vite React static bindings'].entries()) {
    await writeFile(path.join(root, 'src/pages/static/view.tsx'), original.replace('weapp-vite React static bindings', label))
    await waitForOutput('pages/static/index.wxml', label)
    await waitForWatchRound(index + 2)
    if (operation === 'stateful-dev') {
      await waitForClassicReady()
    }
    await assertConsumerClassicSession({ root, operation, output: readOutput(), expectedReason: 'patch-shape' })
  }
}
