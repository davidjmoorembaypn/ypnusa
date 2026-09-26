import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Amazon Bedrock configuration for the AI assistant. Bedrock is opt-in: the
 * standard Anthropic API stays the primary backend and this only applies when
 * USE_BEDROCK=true (or the private config file below sets "useBedrock": true).
 *
 * Sources, in order (first match wins per field):
 *   1. Environment: USE_BEDROCK, AWS_REGION (or AWS_DEFAULT_REGION),
 *      AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN,
 *      AWS_BEARER_TOKEN_BEDROCK (a Bedrock API key), BEDROCK_MODEL.
 *   2. A private JSON file outside the repo and web root (default
 *      ~/.ypnus/aws-bedrock.json, override with AWS_BEDROCK_CONFIG_FILE) - for
 *      shared hosting where environment variables cannot be edited safely.
 *
 * Secrets are never logged and never come from a client request.
 */

export interface BedrockConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  /** A Bedrock API key (bearer token). Takes precedence over the AWS key pair. */
  apiKey?: string;
  /** Bedrock model id, e.g. "anthropic.claude-opus-5". Falls back to the provider default. */
  model?: string;
}

interface BedrockConfigFile {
  useBedrock?: boolean;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  apiKey?: string;
  model?: string;
}

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

type EnvLike = Record<string, string | undefined>;

function readConfigFile(env: EnvLike): BedrockConfigFile | null {
  // turbopackIgnore: the path is only known at runtime; without it the build's file tracer
  // treats this read as "could be anything" and copies the whole repo into the deploy bundle.
  const filePath =
    clean(env.AWS_BEDROCK_CONFIG_FILE) ?? path.join(/*turbopackIgnore: true*/ os.homedir(), ".ypnus", "aws-bedrock.json");
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as BedrockConfigFile) : null;
  } catch {
    return null;
  }
}

/**
 * Returns the Bedrock config when Bedrock is switched on and usable, otherwise
 * null (the caller then uses the standard Anthropic API). `env` is injectable
 * for tests.
 */
export function resolveBedrockConfig(env: EnvLike = process.env): BedrockConfig | null {
  const file = readConfigFile(env);

  const flag = clean(env.USE_BEDROCK)?.toLowerCase();
  const enabled = flag !== undefined ? flag === "true" : file?.useBedrock === true;
  if (!enabled) return null;

  const region = clean(env.AWS_REGION) ?? clean(env.AWS_DEFAULT_REGION) ?? clean(file?.region);
  if (!region) {
    console.error("[ai] USE_BEDROCK is on but no AWS region is set (AWS_REGION or \"region\" in the config file); Bedrock disabled.");
    return null;
  }

  const apiKey = clean(env.AWS_BEARER_TOKEN_BEDROCK) ?? clean(file?.apiKey);
  const accessKeyId = clean(env.AWS_ACCESS_KEY_ID) ?? clean(file?.accessKeyId);
  const secretAccessKey = clean(env.AWS_SECRET_ACCESS_KEY) ?? clean(file?.secretAccessKey);
  if (!apiKey && Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    console.error("[ai] Bedrock needs BOTH an AWS access key id and secret access key (or a Bedrock API key); Bedrock disabled.");
    return null;
  }

  return {
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken: clean(env.AWS_SESSION_TOKEN) ?? clean(file?.sessionToken),
    apiKey,
    model: clean(env.BEDROCK_MODEL) ?? clean(file?.model),
  };
}
