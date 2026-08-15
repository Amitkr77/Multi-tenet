const DEVELOPMENT_VALUES = new Set(['minioadmin', 'change_me_in_env']);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required production environment variable: ${name}`);
  return value;
}

/** Prevent the worker from processing production jobs with local credentials. */
export function validateWorkerEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const databaseUrl = required('DATABASE_URL_APP');
  if ([...DEVELOPMENT_VALUES].some((value) => databaseUrl.includes(value))) {
    throw new Error('DATABASE_URL_APP contains a development credential.');
  }
  for (const name of ['STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY']) {
    const value = required(name);
    if (DEVELOPMENT_VALUES.has(value) || value.length < 16) {
      throw new Error(`${name} must be a non-development credential of at least 16 characters.`);
    }
  }
  required('WEB_APP_URL');
}
