import process from 'node:process'

// 消费验收通过 EOF 使用宿主的正常退出入口；Vite+ 派生的 Node 进程也继承此预加载。
process.stdin.resume()
