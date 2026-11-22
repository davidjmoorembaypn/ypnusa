import fs from "node:fs";

/**
 * Whether the hourly data backup (aws/ops/ypnusa-backup.sh) is actually running, read from the
 * small status file that script writes after every run. The backup directory itself is readable
 * by root only; this file sits in its own directory so the app (and so /api/health and the daily
 * health check) can see that backups are happening without seeing a backup.
 *
 * The file holds times, a size and on/off words only: never a path, a host name or a record.
 */

export const DEFAULT_BACKUP_STATUS_FILE = "/var/backups/ypnusa-status/status.json";

/** The timer runs hourly with up to two minutes of jitter; two missed runs in a row is a problem. */
export const BACKUP_STALE_AFTER_HOURS = 2.5;

export type OffHostCopy = "ok" | "failed" | "off";

export interface BackupStatusFile {
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastLabel?: string;
  lastBytes?: number;
  offHost?: OffHostCopy;
}

export interface BackupHealth {
  /**
   * ok       the last run succeeded within BACKUP_STALE_AFTER_HOURS
   * stale    the last success is older than that (the timer stopped, or the server was off)
   * failing  the most recent run failed
   * unknown  no status file: the backup tool is not installed on this server, or has never run
   */
  status: "ok" | "stale" | "failing" | "unknown";
  lastSuccessAt: string | null;
  /** Hours since the last successful backup, one decimal. null when there has never been one. */
  ageHours: number | null;
  /** The copy to S3: "off" when no bucket is set in the server settings. null when unknown. */
  offHost: OffHostCopy | null;
}

const UNKNOWN: BackupHealth = { status: "unknown", lastSuccessAt: null, ageHours: null, offHost: null };

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Pure: what a status file's contents mean at `now`. Never throws. */
export function interpretBackupStatus(raw: unknown, now: number = Date.now()): BackupHealth {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return UNKNOWN;
  const file = raw as BackupStatusFile;
  const lastSuccessAt = isoOrNull(file.lastSuccessAt);
  const lastFailureAt = isoOrNull(file.lastFailureAt);
  const offHost: OffHostCopy | null = file.offHost === "ok" || file.offHost === "failed" || file.offHost === "off" ? file.offHost : null;
  if (!lastSuccessAt && !lastFailureAt) return UNKNOWN;

  const ageHours = lastSuccessAt ? Math.max(0, Math.round(((now - Date.parse(lastSuccessAt)) / 3_600_000) * 10) / 10) : null;
  let status: BackupHealth["status"];
  if (lastFailureAt && (!lastSuccessAt || Date.parse(lastFailureAt) > Date.parse(lastSuccessAt))) status = "failing";
  else if (ageHours === null || ageHours > BACKUP_STALE_AFTER_HOURS) status = "stale";
  else status = "ok";
  return { status, lastSuccessAt, ageHours, offHost };
}

/** Reads the status file named by YPNUSA_BACKUP_STATUS_FILE (or the default). Never throws. */
export function backupHealth(env: NodeJS.ProcessEnv = process.env, now: number = Date.now()): BackupHealth {
  const file = env.YPNUSA_BACKUP_STATUS_FILE?.trim() || DEFAULT_BACKUP_STATUS_FILE;
  // turbopackIgnore: the path is only known at runtime; without it the build's file tracer
  // cannot tell which file this reads and copies the whole project into the release bundle.
  try {
    return interpretBackupStatus(JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")), now);
  } catch {
    return UNKNOWN;
  }
}
