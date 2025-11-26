import { getSharedLoadMessage, SHARED_ANSWER } from '@/shared/shared-data'

export function sayHello() {
  console.log(getSharedLoadMessage('plugin'))
}

export const answer = SHARED_ANSWER
