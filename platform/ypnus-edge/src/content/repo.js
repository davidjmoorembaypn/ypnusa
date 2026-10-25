// DynamoDB content repository (single table). Key design:
//   post:   pk = POST#<slug>                      sk = META
//   page:   pk = PAGE#<path>                      sk = META
//   list:   gsi1pk = TYPE#post|CAT#<category>     gsi1sk = <ISO publishedAt>#<slug>   (newest first)
// The table, its GSI and TTL-free retention are defined in infra/edge.template.yaml.

const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;

export class ContentRepo {
  /** @param {{doc:{send:Function}, GetCommand:any, QueryCommand:any, table:string}} deps */
  constructor({ doc, GetCommand, QueryCommand, table }) {
    Object.assign(this, { doc, GetCommand, QueryCommand, table });
  }

  async getPost(slug) {
    if (!SLUG.test(slug)) return null;
    const out = await this.doc.send(new this.GetCommand({ TableName: this.table, Key: { pk: `POST#${slug}`, sk: "META" } }));
    return out.Item ?? null;
  }

  async listPosts({ category, limit = 20, cursor } = {}) {
    const out = await this.doc.send(
      new this.QueryCommand({
        TableName: this.table,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :p",
        ExpressionAttributeValues: { ":p": category ? `CAT#${category}` : "TYPE#post" },
        ScanIndexForward: false,
        Limit: Math.min(50, Math.max(1, limit)),
        ...(cursor ? { ExclusiveStartKey: JSON.parse(Buffer.from(cursor, "base64url").toString()) } : {}),
      }),
    );
    return {
      items: out.Items ?? [],
      next: out.LastEvaluatedKey ? Buffer.from(JSON.stringify(out.LastEvaluatedKey)).toString("base64url") : null,
    };
  }
}
