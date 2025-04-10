import type { AutoImportService, BuildService, ConfigService, JsonService, NpmService, ScanService, WatcherService, WxmlService } from './services'
import { inject, injectable } from 'inversify'
import { Symbols } from './Symbols'
import '@/config'

@injectable()
export class CompilerContext {
  /**
   * 构造函数用于初始化编译器上下文对象
   * @param options 可选的编译器上下文配置对象
   */
  constructor(
    @inject(Symbols.ConfigService)
    public readonly configService: ConfigService,
    @inject(Symbols.NpmService)
    public readonly npmService: NpmService,
    @inject(Symbols.WxmlService)
    public readonly wxmlService: WxmlService,
    @inject(Symbols.JsonService)
    public readonly jsonService: JsonService,
    @inject(Symbols.WatcherService)
    public readonly watcherService: WatcherService,
    @inject(Symbols.AutoImportService)
    public readonly autoImportService: AutoImportService,
    @inject(Symbols.BuildService)
    public readonly buildService: BuildService,
    @inject(Symbols.ScanService)
    public readonly scanService: ScanService,
  ) { }
}
