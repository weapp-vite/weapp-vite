import type { DoctorAdapters, DoctorOptions, DoctorReport, DoctorRuntimeEvidence, DoctorRuntimeProbeOptions } from 'weapp-vite/doctor'
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
expectAssignable<DoctorOptions>({ runtime: true, runtimeCliPath: 'selected-cli', runtimeLogin: true, runtimeServicePort: 12345 })
expectAssignable<DoctorRuntimeProbeOptions>({ cliPath: 'selected-cli', login: true, servicePort: 12345 })
expectAssignable<DoctorRuntimeEvidence>({
  host: 'unknown',
  provider: 'devtools',
  route: '',
  checks: [],
  complete: false,
  facts: [{ stage: 'login-state', status: 'unknown', code: 'query-incomplete' }],
})
expectError(runDoctor({ runtimeLogin: 'yes' }))
expectError(runDoctor({ runtimeServicePort: '12345' }))
