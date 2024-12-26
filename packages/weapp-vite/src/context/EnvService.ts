import type { ConfigService } from './ConfigService'
import { inject, injectable } from 'inversify'
import { Symbols } from './Symbols'

@injectable()
export class EnvService {
  /**
   * esbuild 定义的环境变量
   */
  defineEnv: Record<string, any>
  constructor(
    @inject(Symbols.ConfigService)
    private readonly configService: ConfigService,
  ) {
    this.defineEnv = {} // 初始化定义的环境变量对象
  }

  get defineImportMetaEnv() {
    const env = {
      MP_PLATFORM: this.configService.options?.platform,
      ...this.defineEnv,
    }
    const define: Record<string, any> = {}
    for (const [key, value] of Object.entries(env)) {
      define[`import.meta.env.${key}`] = JSON.stringify(value)
    }

    define[`import.meta.env`] = JSON.stringify(env)
    return define
  }

  setDefineEnv(key: string, value: any) {
    this.defineEnv[key] = value
  }
}
