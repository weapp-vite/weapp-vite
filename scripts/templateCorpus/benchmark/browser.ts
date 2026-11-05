import type { ProfileCheckpoint, ProfileFixture, ProfileGroup, ProfileMeasurement, ProfileOptions } from './types'
import process from 'node:process'
import { chromium } from 'playwright'
import { installBenchmarkDocument, loadBenchmarkDocument } from '../../benchmarkWxmlParser/browserDocument'
import { CHROMIUM_ARGUMENTS, STACK_SIZE_KB } from '../../benchmarkWxmlParser/runtime'
import { REGRESSION_PROGRESS_PREFIX } from './progress'

/** 单个后台 Chromium 页面在页内计时；IPC、代码注入与资源收尾不进入样本。 */
export async function profileChromium(code: string, fixtures: ProfileFixture[], groups: ProfileGroup[], options: ProfileOptions, checkpoint?: (record: ProfileCheckpoint) => Promise<void>) {
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGUMENTS })
  try {
    const session = await browser.newBrowserCDPSession()
    let commandLine: string[]
    try {
      commandLine = (await session.send('Browser.getBrowserCommandLine')).arguments
      if (!CHROMIUM_ARGUMENTS.every(argument => commandLine.includes(argument)) || !commandLine.some(argument => argument === '--headless' || argument.startsWith('--headless='))) {
        throw new Error('Chromium did not confirm headless execution and the shared V8 stack budget')
      }
    }
    finally {
      await session.detach()
    }
    const context = await browser.newContext()
    try {
      await installBenchmarkDocument(context)
      const page = await context.newPage()
      if (checkpoint) {
        await page.exposeBinding('__templateCorpusCheckpoint', async (_source, record: ProfileCheckpoint) => checkpoint(record))
      }
      if (options.progress) {
        page.on('console', (message) => {
          if (message.text().startsWith(`${REGRESSION_PROGRESS_PREFIX} `)) {
            process.stdout.write(`[chromium] ${message.text()}\n`)
          }
        })
      }
      const document = await loadBenchmarkDocument(page, 'warm')
      const started = performance.now()
      await page.addScriptTag({ content: code })
      const injectionMs = performance.now() - started
      const result = await page.evaluate(({ fixtures, groups, options, persist }) => {
        const runtime = Reflect.get(globalThis, 'TemplateCorpusProfile') as {
          run: (fixtures: ProfileFixture[], groups: ProfileGroup[], options: ProfileOptions) => ProfileMeasurement
          runWithCheckpoint: (fixtures: ProfileFixture[], groups: ProfileGroup[], options: ProfileOptions, checkpoint: (record: ProfileCheckpoint) => Promise<void>) => Promise<ProfileMeasurement>
        }
        return persist
          ? runtime.runWithCheckpoint(fixtures, groups, options, record => (Reflect.get(globalThis, '__templateCorpusCheckpoint') as (record: ProfileCheckpoint) => Promise<void>)(record))
          : runtime.run(fixtures, groups, options)
      }, { fixtures, groups, options, persist: Boolean(checkpoint) })
      await page.close()
      return { runtime: 'chromium', version: browser.version(), headless: true, commandLine, stackSizeKb: STACK_SIZE_KB, document, injectionMs, memory: null, result }
    }
    finally {
      await context.close()
    }
  }
  finally {
    await browser.close()
  }
}
