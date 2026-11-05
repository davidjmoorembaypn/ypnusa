#!/usr/bin/env python3
"""Load the ZIP territory ledger into DynamoDB from a CSV export of the WordPress ledger.

  python3 aws/scripts/zip-ledger-import.py claimed-zips.csv

CSV header (extra columns are ignored): zip,status,email,subscription_id
  status: claimed | reserved | released   (blank = claimed)
Re-running is safe: rows are written by ZIP, so the newest file wins. Uses boto3 (preinstalled in CloudShell)."""
import csv, os, sys, datetime
import boto3

STACK = os.environ.get("STACK_NAME", "ypnus-site"); REGION = os.environ.get("AWS_REGION", "us-east-1")
outs = boto3.client("cloudformation", region_name=REGION).describe_stacks(StackName=STACK)["Stacks"][0]["Outputs"]
table = boto3.resource("dynamodb", region_name=REGION).Table(next(o["OutputValue"] for o in outs if o["OutputKey"] == "ZipTableName"))

rows, bad = 0, 0
now = datetime.datetime.utcnow().isoformat() + "Z"
with open(sys.argv[1], newline="") as f, table.batch_writer(overwrite_by_pkeys=["zip"]) as w:
    for r in csv.DictReader(f):
        z = (r.get("zip") or "").strip().zfill(5)
        if not z.isdigit() or len(z) != 5:
            bad += 1; continue
        item = {"zip": z, "status": (r.get("status") or "claimed").strip().lower(), "importedAt": now, "source": "wordpress"}
        if r.get("email"): item["email"] = r["email"].strip().lower()
        if r.get("subscription_id"): item["subscriptionId"] = r["subscription_id"].strip()
        w.put_item(Item=item); rows += 1
print(f"imported {rows} ZIPs into {table.name} ({bad} rows skipped)")
