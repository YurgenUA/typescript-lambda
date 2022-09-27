import * as Ajv from 'ajv';
import logger from './logger';

export function validateAgainstSchema(obj: object, inputSchema: any): string {
  const ALREADY_PATCHED = 'alreadyPatched';
  const TYPE_OBJECT = 'object';
  const schema = inputSchema;
  if (schema[ALREADY_PATCHED] == null) {
    schema[ALREADY_PATCHED] = true;
    const schemaObjects = new Array<object>();
    schemaObjects.push(schema.properties);
    while (schemaObjects.length > 0) {
      const currentObject = schemaObjects.pop();
      for (const value of Object.values(currentObject)) {
        const oneProperty: any = value;
        // patch json schema as ajv validates Date instances only if it's marked as 'object' with 'date-time' format
        if (oneProperty.type === 'string' && oneProperty.format === 'date-time') {
          oneProperty.type = TYPE_OBJECT;
        } else if (oneProperty.type === TYPE_OBJECT) {
          schemaObjects.push(oneProperty.properties);
        }
      }
    }
  }
  const validate = new Ajv().compile(schema);

  if (!validate(obj)) {
    const errorMessage = validate.errors.reduce((_, cur) => `${cur.dataPath}:${cur.message}\n`, '');
    const errMessage = `Output validation error(s): ${errorMessage}`;
    logger.error(errMessage);
    return errMessage;
  }
  return null;
}
