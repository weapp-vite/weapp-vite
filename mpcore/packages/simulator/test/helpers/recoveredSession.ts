import { createRecoverableSession } from '../../../../../e2e/utils/recoverableSession'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../../src/browser'

/** 使用同一页面 fixture 验证会话恢复后冷启动与后续 DOM 操作。 */
export function createRecoveredSessionFixture() {
  const create = () => createBrowserHeadlessSession({ files: createBrowserVirtualFiles([
    ['app.json', '{"pages":["pages/index/index","pages/result/index"]}'],
    ['app.js', 'App({})'],
    ['pages/index/index.js', 'Page({data:{count:0},increment(){this.setData({count:this.data.count+1})}})'],
    ['pages/index/index.wxml', '<button id="counter" bindtap="increment">count:{{count}}</button>'],
    ['pages/result/index.js', 'Page({data:{ready:true}})'],
    ['pages/result/index.wxml', '<view id="result">ready:{{ready}}</view>'],
  ]) })
  const owner = createRecoverableSession(create())
  return {
    session: owner.session,
    recover() {
      owner.clear()?.close()
      owner.replace(create())
    },
    close() {
      owner.clear()?.close()
    },
  }
}
