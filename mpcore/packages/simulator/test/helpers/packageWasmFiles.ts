export const addWasmBytes = new Uint8Array([
  0,
  97,
  115,
  109,
  1,
  0,
  0,
  0,
  1,
  7,
  1,
  96,
  2,
  127,
  127,
  1,
  127,
  3,
  2,
  1,
  0,
  7,
  7,
  1,
  3,
  97,
  100,
  100,
  0,
  0,
  10,
  9,
  1,
  7,
  0,
  32,
  0,
  32,
  1,
  106,
  11,
])

export function createPackageWasmFiles(): Array<[string, string | ArrayBuffer]> {
  return [
    ['app.json', JSON.stringify({ pages: ['pages/index'] })],
    ['app.js', 'App({})'],
    ['shared/assets/add.wasm', addWasmBytes.slice().buffer],
    ['pages/index.wxml', '<view id="result">{{result}}</view><view id="bytes">{{bytes}}</view>'],
    ['pages/index.js', `Page({
      data: { result: 0, bytes: '' },
      async run() {
        if (typeof WebAssembly !== 'undefined') throw new Error('Standard WebAssembly must be installed by the adapter');
        for (const key of ['instantiate', 'Module', 'Instance', 'Memory', 'Table']) {
          if (typeof WXWebAssembly[key] !== 'function') throw new Error('Missing WASM host member: ' + key);
        }
        globalThis.WebAssembly = WXWebAssembly;
        const { instance } = await WXWebAssembly.instantiate('/shared/assets/add.wasm', {});
        const result = instance.exports.add(20, 22);
        const fs = wx.getFileSystemManager();
        const directory = wx.env.USER_DATA_PATH + '/sqlite';
        fs.mkdirSync(directory, true);
        const data = new Uint8Array([0, 255, 128, result]).buffer;
        await new Promise((resolve, reject) => fs.writeFile({ filePath: directory + '/snapshot.tmp', data, success: resolve, fail: reject }));
        new Uint8Array(data)[0] = 99;
        fs.renameSync(directory + '/snapshot.tmp', directory + '/snapshot.db');
        const read = await new Promise((resolve, reject) => fs.readFile({ filePath: directory + '/snapshot.db', success: value => resolve(value.data), fail: reject }));
        if (typeof read === 'string') throw new Error('Binary read returned text');
        const bytes = Array.from(new Uint8Array(read)).join(',');
        new Uint8Array(read)[0] = 88;
        const saved = Array.from(new Uint8Array(fs.readFileSync(directory + '/snapshot.db'))).join(',');
        if (saved !== bytes) throw new Error('Read buffers must not alias saved bytes');
        const packaged = await new Promise((resolve, reject) => fs.readFile({ filePath: 'shared/assets/add.wasm', success: value => resolve(value.data), fail: reject }));
        if (new Uint8Array(packaged)[1] !== 97) throw new Error('Invalid packaged WASM bytes');
        fs.writeFileSync(directory + '/unicode.txt', '中文');
        if (fs.readFileSync(directory + '/unicode.txt', 'utf8') !== '中文') throw new Error('Invalid UTF-8 text');
        this.setData({ result, bytes });
        return { result, bytes, saved };
      },
      remove() {
        wx.getFileSystemManager().unlinkSync(wx.env.USER_DATA_PATH + '/sqlite/snapshot.db');
      },
      snapshotSize() {
        return wx.getFileSystemManager().statSync(wx.env.USER_DATA_PATH + '/sqlite/snapshot.db').size;
      },
    })`],
  ]
}
