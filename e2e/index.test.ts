import automator from 'miniprogram-automator'
import path from 'pathe'
import prettier from 'prettier'
import { Templates } from '../@weapp-core/init/scripts/constants'

export function formatWxml(wxml: string) {
  return prettier.format(wxml, {
    parser: 'html',
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
    endOfLine: 'lf',
    trailingComma: 'none',
    printWidth: 180,
    bracketSameLine: true,
    htmlWhitespaceSensitivity: 'ignore',
  })
}

describe.sequential('templates', () => {
  it.each(Templates)('$target', async ({ target }) => {
    const miniProgram = await automator.launch({
      projectPath: path.resolve(import.meta.dirname, `../apps/${target}`),
    })

    const page = await miniProgram.reLaunch('/pages/index/index')
    if (page) {
      const element = await page.$('page')
      if (element) {
        const wxml = await element.wxml()
        // const outerWxml = await element.outerWxml()
        expect(await formatWxml(wxml)).toMatchSnapshot('wxml')
        // expect(await formatWxml(outerWxml)).toMatchSnapshot('outerWxml')
      }
    }

    await miniProgram.close()
  })
})
