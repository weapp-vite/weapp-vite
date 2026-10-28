import './runtime'

// 将安装器和依赖放在同一模块依赖链中，避免入口 import 排序让 parser 提前求值。
export { EventSourceParserStream } from 'eventsource-parser/stream'
