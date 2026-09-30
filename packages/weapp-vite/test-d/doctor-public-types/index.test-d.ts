import type { DoctorAdapters, DoctorOptions, DoctorReport } from 'weapp-vite/doctor'
import { expectAssignable, expectError, expectType } from 'tsd'
import { formatDoctorReport, runDoctor } from 'weapp-vite/doctor'

expectType<Promise<DoctorReport>>(runDoctor())
expectAssignable<DoctorOptions>({ targets: ['weapp', 'alipay'], build: true })
expectType<Promise<0 | 1 | 2>>(runDoctor().then(report => report.exitCode))
expectType<string>(formatDoctorReport({} as DoctorReport, 'sarif'))
expectError(formatDoctorReport({} as DoctorReport, 'xml'))
expectAssignable<Partial<DoctorAdapters>>({
  runtime: async (_cwd, target) => ({ host: target, route: 'pages/index', provider: 'test', checks: ['currentPage'] }),
})
expectError(runDoctor({ runtime: 'yes' }))
