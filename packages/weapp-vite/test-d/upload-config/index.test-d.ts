import type { WeappUploadConfig } from './index.js'
import { expectAssignable, expectError, expectType } from 'tsd'
import { defineConfig } from './index.js'

const config = defineConfig({
  weapp: { upload: { version: '1.2.3', desc: '配置上传说明' } },
})
expectType<string>(config.weapp.upload.version)
expectType<string>(config.weapp.upload.desc)
expectAssignable<WeappUploadConfig>({})
expectAssignable<WeappUploadConfig>({ version: '1.2.3' })
expectAssignable<WeappUploadConfig>({ desc: '配置上传说明' })
expectError(defineConfig({ weapp: { upload: true } }))
expectError(defineConfig({ weapp: { upload: { version: 123 } } }))
expectError(defineConfig({ weapp: { upload: { desc: false } } }))
