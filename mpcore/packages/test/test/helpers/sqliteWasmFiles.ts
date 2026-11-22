import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { rolldown } from 'rolldown'

/** 复用仓库中的真实 SQLite 引擎，验证公开 API 在产物测试宿主中的 WASM 能力。 */
export async function createSqliteWasmFiles(wasmPath = 'engine/sql.wasm'): Promise<Array<[string, string | ArrayBuffer]>> {
  const repoRoot = path.resolve(import.meta.dirname, '../../../../..')
  const fixtureRequire = createRequire(path.join(repoRoot, 'e2e-apps/github-issues/package.json'))
  const sqliteRequire = createRequire(fixtureRequire.resolve('@weapp-sqlite/weapp-vite'))
  const packageRoot = path.dirname(sqliteRequire.resolve('@weapp-sqlite/weapp-vite'))
  const engineRoot = path.dirname(sqliteRequire.resolve('@weapp-sqlite/sqljs/lite'))
  const binary = await readFile(path.join(engineRoot, 'assets/sql-wasm-lite.wasm'))
  const bundle = await rolldown({
    input: path.join(packageRoot, 'runtime.mjs'),
    plugins: [{
      name: 'mpcore-test-sqlite-runtime',
      resolveId(id: string) {
        if (id === 'virtual:weapp-sqlite-runtime') {
          return '\0mpcore-test-sqlite-runtime'
        }
        if (id === 'virtual:weapp-sqlite-devtools') {
          return '\0mpcore-test-sqlite-devtools'
        }
      },
      load(id: string) {
        if (id === '\0mpcore-test-sqlite-runtime') {
          return [
            'import initializer from "@weapp-sqlite/sqljs/lite"',
            'import { createMiniProgramSqliteRuntimeAdapterWithInitializer } from "@weapp-sqlite/weapp-vite/advanced"',
            'export default createMiniProgramSqliteRuntimeAdapterWithInitializer({',
            '  engine: \'sql.js-wasm-lite\',',
            '  platform: \'weapp\',',
            '  runtime: wx,',
            '  webAssembly: WXWebAssembly,',
            `  packageBinaryPath: ${JSON.stringify(`/${wasmPath}`)},`,
            '  initializer,',
            '})',
          ].join('\n')
        }
        if (id === '\0mpcore-test-sqlite-devtools') {
          return 'export function connectSqliteDevtools() {}'
        }
      },
    }],
    tsconfig: false,
  })
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
    ['app.js', `App({
      globalData: {},
      onLaunch() {
        this.globalData.sqliteReady = (async () => {
          const { openSqlite, removeSqlite } = require('./engine/sqlite.js');
          const options = { name: 'mpcore-test-sqlite' };
          await removeSqlite(options);
          let database = await openSqlite(options);
          try {
            await database.exec('CREATE TABLE probe (value INTEGER, text TEXT)');
            await database.exec('INSERT INTO probe VALUES (?, ?)', [1303, '数据库']);
            await database.flush();
          }
          finally {
            await database.close();
          }
          database = await openSqlite(options);
          try {
            const row = (await database.query('SELECT value, text FROM probe')).rows[0];
            return { value: row.value, text: row.text, snapshot: true };
          }
          finally {
            await database.close();
            await removeSqlite(options);
          }
        })();
      },
    })`],
    ['engine/sqlite.js', runtime],
    [wasmPath, new Uint8Array(binary).buffer],
    ['pages/index.wxml', '<view id="value">{{value}}</view><view id="text">{{text}}</view><view id="snapshot">{{snapshot}}</view>'],
    ['pages/index.js', `Page({
      data: { value: 0, text: '', snapshot: false },
      async run() {
        const result = await getApp().globalData.sqliteReady;
        this.setData(result);
        return result;
      },
    })`],
  ]
}
