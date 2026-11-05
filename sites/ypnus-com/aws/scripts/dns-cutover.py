#!/usr/bin/env python3
"""Switch ypnus.com + www between Hostinger and CloudFront in one atomic Route 53 change.

  python3 aws/scripts/dns-cutover.py backup      save today's ypnus.com / www records to dns-backup.json (run first)
  python3 aws/scripts/dns-cutover.py lower-ttl   set those records' TTL to 300s (do this 1 day before cutover)
  python3 aws/scripts/dns-cutover.py cutover     point ypnus.com + www at CloudFront (A + AAAA alias)
  python3 aws/scripts/dns-cutover.py rollback    put the saved Hostinger records back

Settings: STACK_NAME (default ypnus-site), AWS_REGION (us-east-1), APEX (ypnus.com), HOSTED_ZONE_ID (or read from the stack).
Only the ypnus.com and www.ypnus.com A/AAAA/CNAME records are touched. MX, TXT, app.ypnus.com etc. are never changed."""
import json, os, subprocess, sys

STACK = os.environ.get("STACK_NAME", "ypnus-site")
REGION = os.environ.get("AWS_REGION", "us-east-1")
APEX = os.environ.get("APEX", "ypnus.com").rstrip(".")
BACKUP = os.environ.get("BACKUP_FILE", "dns-backup.json")
CLOUDFRONT_ZONE = "Z2FDTNDATAQYW2"  # fixed hosted zone ID for every CloudFront alias
NAMES = [f"{APEX}.", f"www.{APEX}."]

def aws(*args):
    r = subprocess.run(["aws", *args, "--output", "json"], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"aws {' '.join(args[:2])} failed: {r.stderr.strip()}")
    return json.loads(r.stdout or "{}")

def stack_param(key):
    st = aws("cloudformation", "describe-stacks", "--region", REGION, "--stack-name", STACK)["Stacks"][0]
    for p in st.get("Parameters", []) + st.get("Outputs", []):
        if p.get("ParameterKey", p.get("OutputKey")) == key:
            return p.get("ParameterValue", p.get("OutputValue"))
    return ""

ZONE = os.environ.get("HOSTED_ZONE_ID") or stack_param("HostedZoneId")
if not ZONE:
    sys.exit("No hosted zone ID: set HOSTED_ZONE_ID or deploy the stack with HostedZoneId.")

def current():
    sets = aws("route53", "list-resource-record-sets", "--hosted-zone-id", ZONE)["ResourceRecordSets"]
    return [s for s in sets if s["Name"] in NAMES and s["Type"] in ("A", "AAAA", "CNAME")]

def change(changes, comment):
    if not changes:
        print("nothing to change"); return
    r = aws("route53", "change-resource-record-sets", "--hosted-zone-id", ZONE,
            "--change-batch", json.dumps({"Comment": comment, "Changes": changes}))
    cid = r["ChangeInfo"]["Id"]
    print(f"submitted {cid}; waiting for Route 53 to apply it...")
    subprocess.run(["aws", "route53", "wait", "resource-record-sets-changed", "--id", cid], check=False)
    print("done")

def alias_records():
    target = stack_param("DistributionDomain")
    if not target:
        sys.exit("Stack has no DistributionDomain output.")
    return [{"Name": n, "Type": t, "AliasTarget": {"HostedZoneId": CLOUDFRONT_ZONE, "DNSName": target, "EvaluateTargetHealth": False}}
            for n in NAMES for t in ("A", "AAAA")]

cmd = (sys.argv[1:] or [""])[0]
if cmd == "backup":
    recs = current()
    if any("AliasTarget" in r and "cloudfront" in r["AliasTarget"]["DNSName"] for r in recs):
        sys.exit("Records already point at CloudFront; keeping the existing backup file.")
    json.dump(recs, open(BACKUP, "w"), indent=2)
    print(f"saved {len(recs)} records to {BACKUP}:"); [print(" ", r["Name"], r["Type"], r.get("ResourceRecords") or r.get("AliasTarget")) for r in recs]
elif cmd == "lower-ttl":
    change([{"Action": "UPSERT", "ResourceRecordSet": {**r, "TTL": 300}} for r in current() if "TTL" in r], "lower TTL before cutover")
elif cmd == "cutover":
    if not os.path.exists(BACKUP):
        sys.exit(f"Run 'backup' first ({BACKUP} not found).")
    now = current()
    change([{"Action": "DELETE", "ResourceRecordSet": r} for r in now] +
           [{"Action": "CREATE", "ResourceRecordSet": r} for r in alias_records()], "ypnus.com -> CloudFront")
elif cmd == "rollback":
    saved = json.load(open(BACKUP))
    change([{"Action": "DELETE", "ResourceRecordSet": r} for r in current()] +
           [{"Action": "CREATE", "ResourceRecordSet": r} for r in saved], "ypnus.com -> back to Hostinger")
else:
    print(__doc__)
