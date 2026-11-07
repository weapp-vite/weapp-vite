import { getSqliteRuntimeInfo, openSqlite, removeSqlite } from '@weapp-sqlite/weapp-vite/runtime'
import { queryValue } from '../../probe'

const name = 'issue-1303-probe'

Page({
  data: { status: 'ready', value: 'none', engine: 'none', count: 0 },
  async runQuery() {
    this.setData({ status: 'opening' })
    await removeSqlite({ name })
    const database = await openSqlite({ name })
    let value: number | undefined
    let engine: string
    try {
      const result = await database.query<{ value: number }>('SELECT ? AS value', [queryValue])
      value = result.rows[0]?.value
      const info = await getSqliteRuntimeInfo()
      engine = info.engine
    }
    finally {
      await database.close()
      await removeSqlite({ name })
    }
    this.setData({ status: 'queried', value: String(value), engine, count: this.data.count + 1 })
    return { value, engine }
  },
})
