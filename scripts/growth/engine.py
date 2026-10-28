#!/usr/bin/env python3
"""Local growth queue for a Claude-operated agent. Never sends or publishes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

KINDS = ('editorial', 'directory', 'podcast', 'partner', 'social', 'content', 'affiliate')
EVENTS = ('visit', 'lead', 'checkout', 'sale', 'refund', 'fee', 'tax',
          'affiliate_pending', 'affiliate_approved', 'affiliate_reversed', 'affiliate_paid')

def now():
    return datetime.now(timezone.utc).isoformat()

def url(value):
    p = urlsplit(value)
    if p.scheme != 'https' or not p.hostname or p.username or p.password:
        raise ValueError('Use an HTTPS URL without embedded credentials')
    return urlunsplit((p.scheme, p.netloc.lower(), p.path or '/', p.query, ''))

def digest(content):
    return hashlib.sha256(content.encode()).hexdigest()

def connect(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.executescript('''
    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY, url TEXT UNIQUE NOT NULL, kind TEXT NOT NULL,
      title TEXT NOT NULL, relevance INTEGER NOT NULL, audience INTEGER NOT NULL,
      effort INTEGER NOT NULL, evidence TEXT NOT NULL, checked_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'researched', draft TEXT NOT NULL DEFAULT '',
      draft_hash TEXT, approved_hash TEXT, approved_by TEXT, approved_at TEXT,
      submission_evidence TEXT, submitted_at TEXT, placement_url TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, opportunity_id INTEGER NOT NULL REFERENCES opportunities(id),
      kind TEXT NOT NULL, cents INTEGER NOT NULL, currency TEXT NOT NULL,
      evidence TEXT NOT NULL, occurred_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY, opportunity_id INTEGER, action TEXT NOT NULL,
      detail TEXT NOT NULL, created_at TEXT NOT NULL
    );
    ''')
    return db

def audit(db, oid, action, detail):
    db.execute('INSERT INTO audit(opportunity_id,action,detail,created_at) VALUES(?,?,?,?)',
               (oid, action, detail, now()))

def get(db, oid):
    r = db.execute('SELECT * FROM opportunities WHERE id=?', (oid,)).fetchone()
    if r is None:
        raise ValueError('Unknown opportunity')
    return r

def score(r):
    return r['relevance'] * 6 + r['audience'] * 4 - r['effort'] * 2

def add(db, a):
    for value in (a.relevance, a.audience, a.effort):
        if not 0 <= value <= 10:
            raise ValueError('Scores must be between 0 and 10')
    target, evidence = url(a.url), url(a.evidence)
    # Exact canonical URL deduplication; the agent also checks one placement per domain/campaign.
    with db:
        db.execute('''INSERT INTO opportunities
          (url,kind,title,relevance,audience,effort,evidence,checked_at)
          VALUES(?,?,?,?,?,?,?,?)''',
          (target, a.kind, a.title, a.relevance, a.audience, a.effort, evidence, now()))
        oid = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        audit(db, oid, 'research', evidence)
    return {'id': oid, 'status': 'researched'}

def draft(db, a):
    get(db, a.id)
    text = Path(a.file).read_text().strip()
    if not text or len(text) > 30000:
        raise ValueError('Draft must contain 1–30000 characters')
    with db:
        db.execute('''UPDATE opportunities SET draft=?,draft_hash=?,status='draft',
          approved_hash=NULL,approved_by=NULL,approved_at=NULL,
          submission_evidence=NULL,submitted_at=NULL,placement_url=NULL WHERE id=?''',
          (text, digest(text), a.id))
        audit(db, a.id, 'draft', digest(text))
    return {'id': a.id, 'status': 'draft', 'hash': digest(text)}

def approve(db, a):
    r = get(db, a.id)
    if r['status'] != 'draft' or not r['draft_hash']:
        raise ValueError('Only a saved draft may be approved')
    if not a.by.strip() or not a.evidence.strip():
        raise ValueError('Record reviewer and explicit approval evidence')
    with db:
        db.execute('''UPDATE opportunities SET status='approved',approved_hash=draft_hash,
          approved_by=?,approved_at=? WHERE id=?''', (a.by, now(), a.id))
        audit(db, a.id, 'approval', a.evidence)
    return {'id': a.id, 'status': 'approved'}

def record_submission(db, a):
    r = get(db, a.id)
    if r['status'] != 'approved' or r['approved_hash'] != digest(r['draft']):
        raise ValueError('Current exact draft must be approved before submission is recorded')
    with db:
        db.execute('''UPDATE opportunities SET status='submitted',submission_evidence=?,
          submitted_at=? WHERE id=?''', (url(a.evidence), now(), a.id))
        audit(db, a.id, 'submission-recorded', a.evidence)
    return {'id': a.id, 'status': 'submitted', 'note': 'Receipt recorded; no outbound action performed'}

def placement(db, a):
    r = get(db, a.id)
    if r['status'] != 'submitted':
        raise ValueError('Record submission before placement')
    with db:
        db.execute("UPDATE opportunities SET status='placed',placement_url=? WHERE id=?",
                   (url(a.url), a.id))
        audit(db, a.id, 'placement-recorded', url(a.url))
    return {'id': a.id, 'status': 'placed', 'note': 'Agent must independently inspect the placement'}

def event(db, a):
    get(db, a.id)
    if a.cents < 0 or (a.kind in ('visit', 'lead', 'checkout') and a.cents):
        raise ValueError('Use nonnegative cents; traffic events must have zero amount')
    currency = a.currency.upper()
    if len(currency) != 3 or not currency.isalpha():
        raise ValueError('Use a three-letter currency code')
    record = (a.event_id, a.id, a.kind, a.cents, currency, a.evidence, now())
    with db:
        old = db.execute('SELECT * FROM events WHERE id=?', (a.event_id,)).fetchone()
        if old:
            fields = ('id', 'opportunity_id', 'kind', 'cents', 'currency', 'evidence')
            if tuple(old[k] for k in fields) != record[:6]:
                raise ValueError('Event ID already exists with different data')
            return {'duplicate': True, 'id': a.event_id}
        db.execute('INSERT INTO events VALUES(?,?,?,?,?,?,?)', record)
        audit(db, a.id, 'event', a.event_id)
    return {'id': a.event_id, 'kind': a.kind}

def report(db):
    rows = [dict(r) for r in db.execute('SELECT * FROM opportunities')]
    rows.sort(key=score, reverse=True)
    summary = {}
    for r in db.execute('SELECT currency,kind,COUNT(*) n,SUM(cents) cents FROM events GROUP BY currency,kind'):
        bucket = summary.setdefault(r['currency'], {})
        bucket[r['kind']] = {'count': r['n'], 'cents': r['cents']}
    for bucket in summary.values():
        amount = lambda k: bucket.get(k, {}).get('cents', 0)
        bucket['direct_net_proceeds_cents'] = amount('sale') - amount('refund') - amount('fee') - amount('tax')
        # Affiliate states are separate measures, never summed as separate revenues.
        bucket['affiliate_net_approved_cents'] = amount('affiliate_approved') - amount('affiliate_reversed')
    return {'opportunities': [{**r, 'priority_score': score(r)} for r in rows],
            'events_by_currency': summary,
            'notes': ['Manual evidence ledger, not a connection to Stripe, analytics or affiliate partners.',
                      'Sale amounts are gross collected including tax; tax is separately deducted.',
                      'Affiliate pending/approved/paid represent lifecycle stages; do not add them together.',
                      'Traffic events represent individual attributed events, not aggregate imports.',
                      'Revenue events require source verification; visits and clicks are never sales.']}

def tracking(a):
    target = url(a.url)
    if urlsplit(target).hostname not in ('ypnus.com', 'www.ypnus.com', 'app.ypnus.com'):
        raise ValueError('Only add UTMs to owned YPN USA links; preserve partner affiliate links exactly')
    p = urlsplit(target)
    qs = dict(parse_qsl(p.query, keep_blank_values=True))
    qs.update(utm_source=a.source, utm_medium=a.medium, utm_campaign=a.campaign, utm_content=a.content)
    return {'url': urlunsplit((p.scheme, p.netloc, p.path, urlencode(qs), ''))}

def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    default = os.environ.get('YPN_GROWTH_DB', str(Path.home() / '.ypn-growth' / 'growth.sqlite3'))
    p.add_argument('--db', default=default)
    sub = p.add_subparsers(dest='command', required=True)
    sub.add_parser('init')
    sub.add_parser('report')
    a = sub.add_parser('add')
    for flag in ('url', 'title', 'evidence'):
        a.add_argument('--' + flag, required=True)
    a.add_argument('--kind', choices=KINDS, required=True)
    for flag in ('relevance', 'audience', 'effort'):
        a.add_argument('--' + flag, type=int, required=True)
    a = sub.add_parser('draft')
    a.add_argument('id', type=int)
    a.add_argument('--file', required=True)
    a = sub.add_parser('approve')
    a.add_argument('id', type=int)
    a.add_argument('--by', required=True)
    a.add_argument('--evidence', required=True)
    a = sub.add_parser('record-submission')
    a.add_argument('id', type=int)
    a.add_argument('--evidence', required=True)
    a = sub.add_parser('placement')
    a.add_argument('id', type=int)
    a.add_argument('--url', required=True)
    a = sub.add_parser('event')
    a.add_argument('id', type=int)
    a.add_argument('--event-id', required=True)
    a.add_argument('--kind', choices=EVENTS, required=True)
    a.add_argument('--cents', type=int, default=0)
    a.add_argument('--currency', default='USD')
    a.add_argument('--evidence', required=True)
    a = sub.add_parser('tracking')
    a.add_argument('--url', required=True)
    for flag in ('source', 'medium', 'campaign'):
        a.add_argument('--' + flag, required=True)
    a.add_argument('--content', default='primary-cta')
    a = p.parse_args(argv)
    if a.command == 'tracking':
        return tracking(a)
    with connect(a.db) as db:
        if a.command == 'init':
            return {'database': a.db, 'status': 'ready'}
        if a.command == 'report':
            return report(db)
        return {'add': add, 'draft': draft, 'approve': approve,
                'record-submission': record_submission, 'placement': placement,
                'event': event}[a.command](db, a)

if __name__ == '__main__':
    try:
        print(json.dumps(main(), indent=2))
    except (ValueError, sqlite3.Error, OSError) as exc:
        print(json.dumps({'error': str(exc)}), file=sys.stderr)
        sys.exit(1)
