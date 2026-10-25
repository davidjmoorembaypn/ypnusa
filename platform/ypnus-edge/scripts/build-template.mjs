// Injects the CloudFront Function code into the CloudFormation template -> infra/dist/edge.yaml
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFunctionCode } from "./build-function.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const code = buildFunctionCode();
const bytes = Buffer.byteLength(code);
if (bytes > 10_000) throw new Error(`CloudFront Function is ${bytes} bytes; limit is 10240`);

const template = readFileSync(join(root, "infra/edge.template.yaml"), "utf8");
const indented = code.trimEnd().split("\n").map((l) => `          ${l}`).join("\n");
if (!template.includes("__REDIRECT_FUNCTION_CODE__")) throw new Error("placeholder missing");
mkdirSync(join(root, "infra/dist"), { recursive: true });
writeFileSync(join(root, "infra/dist/edge.yaml"), template.replace("          __REDIRECT_FUNCTION_CODE__", indented));
console.log(`infra/dist/edge.yaml written (redirect function ${bytes} bytes)`);
