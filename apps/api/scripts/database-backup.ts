import { spawnSync } from 'node:child_process';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';

import {
  buildPgDumpArgs,
  buildPgRestoreVerifyArgs,
  buildPostgresChildEnvironment,
  resolveDatabaseBackupConfig
} from './database-backup-config';

async function main() {
  const config = resolveDatabaseBackupConfig(process.env);
  const temporaryPath = `${config.finalPath}.${process.pid}.tmp`;
  const childEnvironment = buildPostgresChildEnvironment(process.env, config);

  await mkdir(config.directory, { recursive: true });

  try {
    run(
      config.pgDumpBin,
      buildPgDumpArgs(config, temporaryPath),
      childEnvironment,
      'pg_dump'
    );
    run(
      config.pgRestoreBin,
      buildPgRestoreVerifyArgs(temporaryPath),
      childEnvironment,
      'pg_restore verification'
    );

    const file = await stat(temporaryPath);
    if (!file.isFile() || file.size === 0) {
      throw new Error('Database backup artifact is empty.');
    }

    await rename(temporaryPath, config.finalPath);
    process.stdout.write(
      `Database backup created and verified; path=${config.finalPath}; bytes=${file.size}\n`
    );
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

function run(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  stage: string
) {
  const result = spawnSync(command, args, {
    env: environment,
    shell: false,
    stdio: ['ignore', 'ignore', 'inherit']
  });

  if (result.error) {
    throw new Error(`${stage} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `${stage} failed with exit code ${result.status ?? 'unknown'}.`
    );
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown backup error.';
  process.stderr.write(`Database backup failed safely: ${message}\n`);
  process.exitCode = 1;
});
