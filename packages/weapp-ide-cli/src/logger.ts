import process from 'node:process'
import baseLogger, { colors } from '@weapp-core/logger'

// 诊断与协议数据分流；独立实例不改变其他包的日志输出配置。
const logger = baseLogger.create({ stdout: process.stderr, stderr: process.stderr })

export { colors }

export default logger
