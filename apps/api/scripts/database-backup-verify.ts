import { spawnSync } from 'node:child_process';

import {
  buildBackupToolEnvironment,
  buildPgRestoreVerifyArgs,
  resolveBackupArtifactPath
} from './database-backup-config';

try {
  const backupPath = resolveBackupArtifactPath(
    process.env.DATABASE_BACKUP_PATH
  );
  const pgRestoreBin = process.env.PG_RESTORE_BIN?.trim() || 'pg_restore';
  const result = spawnSync(pgRestoreBin, buildPgRestoreVerifyArgs(backupPath), {
    env: buildBackupToolEnvironment(process.env),
    shell: false,
    stdio: ['ignore', 'ignore', 'inherit']
  });

  if (result.error) {
    throw new Error(`pg_restore could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `pg_restore failed with exit code ${result.status ?? 'unknown'}.`
    );
  }

  process.stdout.write(`Database backup verified; path=${backupPath}\n`);
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Unknown verification error.';
  process.stderr.write(
    `Database backup verification failed safely: ${message}\n`
  );
  process.exitCode = 1;
}
