"""Rebuild the small national origination series from FHFA's quarterly public file."""
import csv
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

URL = "https://www.fhfa.gov/document/d/nmdb/nmdb-new-mortgage-statistics-national-census-areas-quarterly.zip"
OUT = Path(__file__).resolve().parents[1] / "src/lib/ai/nmdb-originations.json"
markets = {"All Mortgages": "all", "Jumbo Market": "jumbo"}
purposes = {"": "all", " (Home Purchase)": "purchase", " (Refinance)": "refinance"}
labels = {market + suffix: f"{segment}_{purpose}" for market, segment in markets.items() for suffix, purpose in purposes.items()}
metrics = {"TOT_ORIG": "countThousands", "TOT_LOANAMT": "volumeMillionsUSD"}

archive = Path(sys.argv[1]) if len(sys.argv) > 1 else io.BytesIO(urllib.request.urlopen(URL, timeout=60).read())
records = {}
with zipfile.ZipFile(archive) as z, z.open("nmdb-new-mortgage-statistics-national-census-areas-quarterly.csv") as raw:
    for row in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig")):
        metric = metrics.get(row["SERIESID"])
        label = labels.get(row["MARKET"])
        if row["GEOID"] != "USA" or row["GEOLEVEL"] != "National" or not metric or not label or row["SUPPRESSED"] != "0":
            continue
        values = records.setdefault(label, {}).setdefault(row["PERIOD"], {})
        values[metric] = float(row["VALUE1"])
if set(records) != set(labels.values()):
    raise ValueError("Expected all six national market segments")
OUT.write_text(json.dumps(records, separators=(",", ":"), sort_keys=True) + "\n")
