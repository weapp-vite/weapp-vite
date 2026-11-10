import path from 'node:path'
import { rolldown } from 'rolldown'

/** 使用真实兼容层复现异步小程序随机数接口与同步 Web Crypto 的契约边界。 */
export async function createWebCryptoFiles(): Promise<Array<[string, string]>> {
  const bundle = await rolldown({
    input: path.resolve(import.meta.dirname, '../../../../../packages-runtime/web-apis/src/crypto.ts'),
    tsconfig: false,
  })
  let code: string
  try {
    const { output } = await bundle.generate({ format: 'cjs' })
    if (output.length !== 1 || output[0]?.type !== 'chunk') {
      throw new Error('Expected one Web Crypto fixture chunk')
    }
    code = output[0].code
  }
  finally {
    await bundle.close()
  }
  return [
    ['app.json', '{"pages":["pages/index"]}'],
    ['crypto.js', code],
    ['app.js', `
      let hostCalls = 0;
      // 微信同名接口异步返回结果，不会同步修改传入对象。
      wx.getRandomValues = async options => {
        hostCalls++;
        return { randomValues: new ArrayBuffer(options.length) };
      };
      App({ readHostCalls: () => hostCalls });
    `],
    ['pages/index.js', `
      const { cryptoPolyfill } = require('../crypto');
      const target = new Uint8Array(4);
      const returned = cryptoPolyfill.getRandomValues(target);
      const uuids = Array.from({ length: 5 }, () => cryptoPolyfill.randomUUID());
      Page({ data: {
        hostCalls: getApp().readHostCalls(),
        sameArray: returned === target,
        unique: new Set(uuids).size === uuids.length,
        valid: uuids.every(uuid => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)),
      } });
    `],
    ['pages/index.wxml', '<view id="crypto-state">{{hostCalls}}/{{sameArray}}/{{unique}}/{{valid}}</view>'],
  ]
}
