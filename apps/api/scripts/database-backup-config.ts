import { resolve } from 'node:path';

export interface DatabaseBackupConfig {
  connection: {
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
    sslMode?: string;
  };
  directory: string;
  finalPath: string;
  pgDumpBin: string;
  pgRestoreBin: string;
}

export function resolveDatabaseBackupConfig(
  environment: NodeJS.ProcessEnv,
  now = new Date(),
  cwd = process.cwd()
): DatabaseBackupConfig {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for database backup.');
  }

  const url = parsePostgresUrl(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database || database.includes('/')) {
    throw new Error('DATABASE_URL must include one PostgreSQL database name.');
  }

  const port = url.port || '5432';
  if (!/^\d{1,5}$/.test(port) || Number(port) > 65_535) {
    throw new Error('DATABASE_URL contains an invalid PostgreSQL port.');
  }

  const directory = resolve(
    cwd,
    environment.DATABASE_BACKUP_DIRECTORY?.trim() || 'backups'
  );
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const safeDatabaseName = database.replace(/[^A-Za-z0-9_-]/g, '_');
  const finalPath = resolve(
    directory,
    `optime-${safeDatabaseName}-${timestamp}.dump`
  );

  return {
    connection: {
      host: url.hostname,
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
      sslMode: url.searchParams.get('sslmode') || undefined
    },
    directory,
    finalPath,
    pgDumpBin: environment.PG_DUMP_BIN?.trim() || 'pg_dump',
    pgRestoreBin: environment.PG_RESTORE_BIN?.trim() || 'pg_restore'
  };
}

export function resolveBackupArtifactPath(
  configuredPath: string | undefined,
  cwd = process.cwd()
) {
  const backupPath = configuredPath?.trim();
  if (!backupPath) {
    throw new Error('DATABASE_BACKUP_PATH is required to verify a backup.');
  }
  if (!backupPath.toLowerCase().endsWith('.dump')) {
    throw new Error('DATABASE_BACKUP_PATH must end with .dump.');
  }

  return resolve(cwd, backupPath);
}

export function buildPgDumpArgs(
  config: DatabaseBackupConfig,
  outputPath: string
) {
  return [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--host',
    config.connection.host,
    '--port',
    config.connection.port,
    '--username',
    config.connection.user,
    '--dbname',
    config.connection.database,
    '--file',
    outputPath
  ];
}

export function buildPgRestoreVerifyArgs(backupPath: string) {
  return ['--list', backupPath];
}

export function buildPostgresChildEnvironment(
  environment: NodeJS.ProcessEnv,
  config: DatabaseBackupConfig
) {
  const childEnvironment = buildBackupToolEnvironment(environment);

  if (config.connection.password) {
    childEnvironment.PGPASSWORD = config.connection.password;
  }
  if (config.connection.sslMode) {
    childEnvironment.PGSSLMODE = config.connection.sslMode;
  }

  return childEnvironment;
}

export function buildBackupToolEnvironment(environment: NodeJS.ProcessEnv) {
  const childEnvironment: NodeJS.ProcessEnv = {};
  const inheritedKeys = [
    'PATH',
    'Path',
    'PATHEXT',
    'SystemRoot',
    'SYSTEMROOT',
    'TEMP',
    'TMP',
    'HOME',
    'LANG'
  ];

  for (const key of inheritedKeys) {
    if (environment[key]) childEnvironment[key] = environment[key];
  }

  return childEnvironment;
}

function parsePostgresUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  return url;
}
