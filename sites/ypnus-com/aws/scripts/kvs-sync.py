#!/usr/bin/env python3
"""Make the CloudFront KeyValueStore hold exactly the redirects in aws/dist/kvs.json.
Usage: python3 aws/scripts/kvs-sync.py <RedirectStoreArn> aws/dist/kvs.json   (uses the AWS CLI v2, as in CloudShell)"""
import json, subprocess, sys

def aws(*args):
    r = subprocess.run(["aws", "cloudfront-keyvaluestore", *args, "--output", "json"], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"aws cloudfront-keyvaluestore {args[0]} failed: {r.stderr.strip()}")
    return json.loads(r.stdout or "{}")

arn, path = sys.argv[1], sys.argv[2]
want = json.load(open(path))
etag = aws("describe-key-value-store", "--kvs-arn", arn)["ETag"]
have = {i["Key"]: i["Value"] for i in aws("list-keys", "--kvs-arn", arn).get("Items", [])}
puts = [{"Key": k, "Value": v} for k, v in want.items() if have.get(k) != v]
deletes = [{"Key": k} for k in have if k not in want]
ops = [("put", p) for p in puts] + [("del", d) for d in deletes]
for i in range(0, len(ops), 50):  # API limit: 50 keys per call
    batch = ops[i:i + 50]
    args = ["update-keys", "--kvs-arn", arn, "--if-match", etag]
    p = [x for t, x in batch if t == "put"]
    d = [x for t, x in batch if t == "del"]
    if p: args += ["--puts", json.dumps(p)]
    if d: args += ["--deletes", json.dumps(d)]
    etag = aws(*args)["ETag"]
print(f"redirect store: {len(want)} keys ({len(puts)} added/changed, {len(deletes)} removed)")
