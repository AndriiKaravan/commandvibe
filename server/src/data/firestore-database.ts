/** The Firestore database the server uses; the commandvibe-ks project has a named one, not `(default)`. */
export function firestoreDatabaseId(env: NodeJS.ProcessEnv): string {
  return env.FIRESTORE_DATABASE?.trim() || '(default)';
}
