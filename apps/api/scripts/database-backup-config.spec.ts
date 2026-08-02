import { join } from 'node:path';

import {
  buildBackupToolEnvironment,
  buildPgDumpArgs,
  buildPgRestoreVerifyArgs,
  buildPostgresChildEnvironment,
  resolveBackupArtifactPath,
  resolveDatabaseBackupConfig
} from './database-backup-config';

describe('database backup configuration', () => {
  it('builds a deterministic credential-free pg_dump command', () => {
    const config = resolveDatabaseBackupConfig(
      {
        DATABASE_URL:
          'postgresql://optime:private-password@db.example:5433/optime_prod?sslmode=require',
        DATABASE_BACKUP_DIRECTORY: 'safe-backups',
        PG_DUMP_BIN: 'custom-pg-dump',
        PG_RESTORE_BIN: 'custom-pg-restore'
      },
      new Date('2026-08-02T01:02:03.456Z'),
      'C:\\optime'
    );

    expect(config).toMatchObject({
      connection: {
        host: 'db.example',
        port: '5433',
        user: 'optime',
        password: 'private-password',
        database: 'optime_prod',
        sslMode: 'require'
      },
      pgDumpBin: 'custom-pg-dump',
      pgRestoreBin: 'custom-pg-restore'
    });
    expect(config.finalPath).toBe(
      join(config.directory, 'optime-optime_prod-20260802T010203Z.dump')
    );

    const args = buildPgDumpArgs(config, `${config.finalPath}.tmp`);
    expect(args).toContain('optime_prod');
    expect(args).not.toContain('private-password');
    expect(JSON.stringify(args)).not.toContain('postgresql://');
  });

  it('passes only bounded process values and PostgreSQL credentials to pg tools', () => {
    const environment = {
      DATABASE_URL: 'postgresql://optime:private-password@db.example/optime',
      OPENAI_API_KEY: 'must-not-be-inherited',
      JWT_SECRET: 'must-not-be-inherited',
      PATH: 'safe-path'
    };
    const config = resolveDatabaseBackupConfig(
      environment,
      new Date('2026-08-02T01:02:03.456Z'),
      'C:\\optime'
    );

    expect(buildPostgresChildEnvironment(environment, config)).toEqual({
      PATH: 'safe-path',
      PGPASSWORD: 'private-password'
    });
    expect(buildBackupToolEnvironment(environment)).toEqual({
      PATH: 'safe-path'
    });
  });

  it('rejects missing or non-PostgreSQL database URLs', () => {
    expect(() => resolveDatabaseBackupConfig({})).toThrow(
      'DATABASE_URL is required'
    );
    expect(() =>
      resolveDatabaseBackupConfig({ DATABASE_URL: 'https://db.example/optime' })
    ).toThrow('valid PostgreSQL URL');
  });

  it('requires an explicit custom-format artifact for standalone verification', () => {
    expect(() => resolveBackupArtifactPath(undefined)).toThrow(
      'DATABASE_BACKUP_PATH is required'
    );
    expect(() => resolveBackupArtifactPath('backup.sql')).toThrow(
      'DATABASE_BACKUP_PATH must end with .dump'
    );
    expect(buildPgRestoreVerifyArgs('backup.dump')).toEqual([
      '--list',
      'backup.dump'
    ]);
  });
});
