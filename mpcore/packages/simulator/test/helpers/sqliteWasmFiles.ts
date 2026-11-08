import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { rolldown } from 'rolldown'

/** 复用 Issue fixture 已安装的真实 SQLite 引擎，浏览器与 headless 使用同一份 WASM 和 SQL。 */
export async function createSqliteWasmFiles(wasmPath = 'engine/sql.wasm'): Promise<Array<[string, string | ArrayBuffer]>> {
  const repoRoot = path.resolve(import.meta.dirname, '../../../../..')
  const fixtureRequire = createRequire(path.join(repoRoot, 'e2e-apps/github-issues/package.json'))
  const sqliteRequire = createRequire(fixtureRequire.resolve('@weapp-sqlite/weapp-vite'))
  const engineRoot = path.dirname(sqliteRequire.resolve('@weapp-sqlite/sqljs/lite'))
  const [script, binary] = await Promise.all([
    readFile(path.join(engineRoot, 'vendor/sql-wasm-lite.js'), 'utf8'),
    readFile(path.join(engineRoot, 'assets/sql-wasm-lite.wasm')),
  ])
  const bundle = await rolldown({ input: sqliteRequire.resolve('@weapp-sqlite/miniprogram/runtime'), tsconfig: false })
  let runtime: string
  try {
    const { output } = await bundle.generate({ format: 'cjs', codeSplitting: false })
    const entry = output.find(item => item.type === 'chunk' && item.isEntry)
    if (!entry || entry.type !== 'chunk') {
      throw new Error('SQLite mini-program runtime entry was not emitted')
    }
    runtime = entry.code
  }
  finally {
    await bundle.close()
  }
  return [
    ['app.json', JSON.stringify({ pages: ['pages/index'] })],
    ['app.js', 'App({})'],
    ['engine/sql.js', script],
    ['engine/storage.js', runtime],
    [wasmPath, new Uint8Array(binary).buffer],
    ['pages/index.wxml', '<view id="value">{{value}}</view><view id="text">{{text}}</view><view id="snapshot">{{snapshot}}</view>'],
    ['pages/index.js', `Page({
      data: { value: 0, text: '', snapshot: false },
      async run() {
        const initSqlJs = require('../engine/sql.js');
        const { createMiniProgramSqliteWasmStorage, createMiniProgramSqlJsInitializer } = require('../engine/storage.js');
        const options = { platform: 'weapp', runtime: wx, webAssembly: WXWebAssembly };
        const storage = createMiniProgramSqliteWasmStorage(options);
        await storage.remove('probe');
        if (await storage.load('probe') !== undefined) throw new Error('Cold database must be absent');
        const initialize = createMiniProgramSqlJsInitializer({ ...options, initializer: initSqlJs, packageBinaryPath: ${JSON.stringify(`/${wasmPath}`)} });
        const SQL = await initialize();
        let db = new SQL.Database();
        db.run('CREATE TABLE probe (value INTEGER, text TEXT)');
        db.run('INSERT INTO probe VALUES (?, ?)', [1303, '数据库']);
        await storage.save('probe', db.export());
        await storage.save('probe', db.export());
        db.close();
        const snapshot = await storage.load('probe');
        db = new SQL.Database(snapshot);
        try {
          const row = db.exec('SELECT value, text FROM probe')[0].values[0];
          const result = { value: row[0], text: row[1], snapshot: new Uint8Array(snapshot).byteLength > 16 };
          this.setData(result);
          return result;
        }
        finally {
          db.close();
          await storage.remove('probe');
          await storage.remove('probe');
        }
      },
    })`],
  ]
}
