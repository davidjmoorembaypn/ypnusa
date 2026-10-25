import { test } from "node:test";
import assert from "node:assert/strict";
import { dynamoKv, redisKv, SegmentStore } from "../src/segments/store.js";
import { ContentRepo } from "../src/content/repo.js";

class Cmd { constructor(input) { this.input = input; } }

test("dynamoKv reads SEG#<id> by primary key with an eventually-consistent read", async () => {
  let sent;
  const doc = { send: async (c) => ((sent = c), { Item: { pk: "SEG#h", segments: ["reader_mlo"] } }) };
  const store = new SegmentStore({ kv: dynamoKv({ doc, GetCommand: Cmd, table: "state" }) });
  const out = await store.lookup("h", 25);
  assert.equal(sent.input.TableName, "state");
  assert.deepEqual(sent.input.Key, { pk: "SEG#h" });
  assert.equal(sent.input.ConsistentRead, false);
  assert.deepEqual(out.segments.map((s) => s.id), ["reader_mlo"]);
});

test("redisKv parses JSON values, returns null for a miss, and failures fail open", async () => {
  const data = { "seg:SEG#h": JSON.stringify({ segments: ["viewed_pricing"] }) };
  const redis = { get: async (k) => data[k] ?? null };
  const store = new SegmentStore({ kv: redisKv({ redis }) });
  assert.deepEqual((await store.lookup("h", 25)).segments.map((s) => s.id), ["viewed_pricing"]);
  assert.deepEqual((await store.lookup("none", 25)).segments, []);
  const broken = new SegmentStore({ kv: redisKv({ redis: { get: async () => { throw new Error("ECONNRESET"); } } }) });
  assert.equal((await broken.lookup("h", 25)).source, "error");
});

test("ContentRepo: validates slugs, keys, newest-first paging and cursors", async () => {
  const calls = [];
  const doc = { send: async (c) => { calls.push(c); return c instanceof Cmd && c.input.Key ? { Item: { title: "T" } } : { Items: [{ slug: "a" }], LastEvaluatedKey: { pk: "x" } }; } };
  class Get extends Cmd {} class Query extends Cmd {}
  const repo = new ContentRepo({ doc, GetCommand: Get, QueryCommand: Query, table: "content" });
  assert.equal(await repo.getPost("../../etc"), null, "bad slug never reaches DynamoDB");
  assert.equal(calls.length, 0);
  assert.deepEqual((await repo.getPost("hello-world")), { title: "T" });
  assert.deepEqual(calls[0].input.Key, { pk: "POST#hello-world", sk: "META" });
  const page = await repo.listPosts({ category: "tips", limit: 500 });
  const q = calls[1].input;
  assert.equal(q.IndexName, "gsi1");
  assert.equal(q.ScanIndexForward, false);
  assert.equal(q.Limit, 50);
  assert.equal(q.ExpressionAttributeValues[":p"], "CAT#tips");
  assert.ok(page.next);
  await repo.listPosts({ cursor: page.next });
  assert.deepEqual(calls[2].input.ExclusiveStartKey, { pk: "x" });
});
