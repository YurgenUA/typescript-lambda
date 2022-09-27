export class MongoDuplicatesError extends Error {
  constructor() {
    super('Duplicates while storing to database.');
  }
}
