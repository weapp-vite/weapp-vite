import type { ProfileFixture, ProfileGroup, ProfileMeasurement, ProfileOptions } from './types'
import { chromium } from 'playwright'
import { installBenchmarkDocument, loadBenchmarkDocument } from '../../benchmarkWxmlParser/browserDocument'
import { CHROMIUM_ARGUMENTS, STACK_SIZE_KB } from '../../benchmarkWxmlParser/runtime'

/** 单个后台 Chromium 页面在页内计时；IPC、代码注入与资源收尾不进入样本。 */
export async function profileChromium(code: string, fixtures: ProfileFixture[], groups: ProfileGroup[], options: ProfileOptions) {
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
      const document = await loadBenchmarkDocument(page, 'warm')
      const started = performance.now()
      await page.addScriptTag({ content: code })
      const injectionMs = performance.now() - started
      const result = await page.evaluate(({ fixtures, groups, options }) => {
        const runtime = Reflect.get(globalThis, 'TemplateCorpusProfile') as { run: (fixtures: ProfileFixture[], groups: ProfileGroup[], options: ProfileOptions) => ProfileMeasurement }
        return runtime.run(fixtures, groups, options)
      }, { fixtures, groups, options })
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
