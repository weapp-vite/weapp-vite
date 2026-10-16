/// <reference types="vite/client" />
import appScript from '../../../../../e2e-apps/github-issues/fixtures/issue-1235/src/app.js?raw'
import appJson from '../../../../../e2e-apps/github-issues/fixtures/issue-1235/src/app.json?raw'
import childScript from '../../../../../e2e-apps/github-issues/fixtures/issue-1235/src/components/child/index.js?raw'
import childJson from '../../../../../e2e-apps/github-issues/fixtures/issue-1235/src/components/child/index.json?raw'
import childTemplate from '../../../../../e2e-apps/github-issues/fixtures/issue-1235/src/components/child/index.wxml?raw'
import emptyScript from '../../../../../e2e-apps/github-issues/fixtures/issue-1235/src/pages/empty/index.js?raw'
import emptyJson from '../../../../../e2e-apps/github-issues/fixtures/issue-1235/src/pages/empty/index.json?raw'
import emptyTemplate from '../../../../../e2e-apps/github-issues/fixtures/issue-1235/src/pages/empty/index.wxml?raw'
import pageScript from '../../../../../e2e-apps/github-issues/fixtures/issue-1235/src/pages/index/index.js?raw'
import pageJson from '../../../../../e2e-apps/github-issues/fixtures/issue-1235/src/pages/index/index.json?raw'
import pageTemplate from '../../../../../e2e-apps/github-issues/fixtures/issue-1235/src/pages/index/index.wxml?raw'

/** 与真实微信复用原生源码，精确覆盖条件循环节点事件引起的同步更新。 */
export const componentEventReentryFiles: Array<[string, string]> = [
  ['project.config.json', '{"miniprogramRoot":"."}'],
  ['app.js', appScript],
  ['app.json', appJson],
  ['pages/index/index.js', pageScript],
  ['pages/index/index.json', pageJson],
  ['pages/index/index.wxml', pageTemplate],
  ['pages/empty/index.js', emptyScript],
  ['pages/empty/index.json', emptyJson],
  ['pages/empty/index.wxml', emptyTemplate],
  ['components/child/index.js', childScript],
  ['components/child/index.json', childJson],
  ['components/child/index.wxml', childTemplate],
]
