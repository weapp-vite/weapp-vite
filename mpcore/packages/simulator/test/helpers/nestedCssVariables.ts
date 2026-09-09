/// <reference types="vite/client" />
import pageScript from '../../../../../e2e-apps/github-issues/src/pages/css-nested-vars/index.js?raw'
import pageJson from '../../../../../e2e-apps/github-issues/src/pages/css-nested-vars/index.json?raw'
import pageTemplate from '../../../../../e2e-apps/github-issues/src/pages/css-nested-vars/index.wxml?raw'
import pageStyle from '../../../../../e2e-apps/github-issues/src/pages/css-nested-vars/index.wxss?raw'

export const nestedCssVariableFiles: Array<[string, string]> = [
  ['project.config.json', '{"miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/css-nested-vars/index"]}'],
  ['app.js', 'App({})'],
  ['pages/css-nested-vars/index.js', pageScript],
  ['pages/css-nested-vars/index.json', pageJson],
  ['pages/css-nested-vars/index.wxml', pageTemplate],
  ['pages/css-nested-vars/index.wxss', pageStyle],
]

export const nestedCssVariableStyle = pageStyle
