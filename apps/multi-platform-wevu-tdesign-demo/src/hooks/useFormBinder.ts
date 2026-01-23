import type { ModelBindingOptions, ModelBindingPayload } from 'wevu'
import { useBindModel } from 'wevu'

export function useFormBinder() {
  const bindModel = useBindModel()

  function changeModel<T, ValueProp extends string = 'value', Formatted = T>(
    path: string,
    options?: ModelBindingOptions<T, 'change', ValueProp, Formatted>,
  ): ModelBindingPayload<T, 'change', ValueProp, Formatted> {
    return bindModel(path).model({ event: 'change', ...options })
  }

  return {
    changeModel,
  }
}
