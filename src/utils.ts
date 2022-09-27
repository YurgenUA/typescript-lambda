import { AsyncLocalStorage } from 'async_hooks';
import * as _ from 'lodash';
import { OutgoingMessage, OutgoingMessageData } from './definitions';

const localStorage = new AsyncLocalStorage();
export { localStorage };

export async function withLoggingContext(func, correlationId:string): Promise<void> {
  return localStorage.run(correlationId, func);
}

export function getLoggingContext() {
  return localStorage.getStore();
}

export function omitByDeep(obj) {
  if (!_.isPlainObject(obj)) {
    return obj;
  }

  /* eslint-disable no-param-reassign */
  Object.entries(obj).forEach(([key, value]) => {
    if (_.isPlainObject(value)) {
      obj[key] = omitByDeep(value);
    } else if (_.isArray(value)) {
      const arrayValue = (value as []).map(omitByDeep).filter(_.negate(_.isNil));
      if (arrayValue.length > 0) {
        obj[key] = arrayValue;
      } else {
        delete obj[key];
      }
    }
  });
  const omitted = _.omitBy(obj, _.isNil);
  return Object.keys(omitted).length > 0 ? omitted : null;
}

export function formatOutputMessage(correlationId, data: OutgoingMessageData): OutgoingMessage {
  return {
    data,
    metadata: {
      correlationId
    }
  };
}
