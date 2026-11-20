import { handleMcpRequest } from "@/lib/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Remote MCP server (Streamable HTTP) for loan officers: ZIP code lock-in availability and Cerebro.
 * Connect a client to https://ypnus.com/api/mcp. All four methods go through one handler that owns
 * CORS, origin checks and the stateless transport; see src/lib/mcp/http.ts for what each one does.
 */
export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export async function OPTIONS(request: Request) {
  return handleMcpRequest(request);
}
