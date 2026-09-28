import { z } from 'zod'

// 必须先于 Core 的模块初始化执行，避免 Zod 构造 schema 时探测动态求值。
z.config({ jitless: true })
