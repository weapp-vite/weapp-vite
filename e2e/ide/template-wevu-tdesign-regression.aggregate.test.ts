import { afterAll } from 'vitest'
import { closeTdesignRegressionSession, declareTdesignRegressionAggregate } from './tdesignRegressionSession'
import './template-weapp-vite-wevu-tailwindcss-tdesign-template.class-style-binding.test'
import './template-weapp-vite-wevu-tailwindcss-tdesign-template.form.test'
import './template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test'
import './template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test'

// 静态导入只注册子 suite；在其 hooks 开始执行前统一接管会话收尾。
declareTdesignRegressionAggregate()

afterAll(async () => {
  await closeTdesignRegressionSession(true)
}, 30_000)
