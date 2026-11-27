import { firestoreDatabaseId } from './firestore-database';

describe('firestoreDatabaseId', () => {
  it('should use the named database from FIRESTORE_DATABASE', () => {
    expect(firestoreDatabaseId({ FIRESTORE_DATABASE: 'commandvibe' })).toBe('commandvibe');
  });

  it('should fall back to the default database when unset or blank', () => {
    expect(firestoreDatabaseId({})).toBe('(default)');
    expect(firestoreDatabaseId({ FIRESTORE_DATABASE: '  ' })).toBe('(default)');
  });
});
