# Moving to PostgreSQL, Phase 1: paid plans and the ZIP code ledger

Phase 1 moves two things from the single data file (`store.json`) to a PostgreSQL database: the paid plans
(subscriptions) and the list of which ZIP code is locked by whom. Everything else stays in the data file for now.

- **Nothing changes until a setting is switched.** With no database configured the site runs exactly as before.
- **No maintenance window.** Each step is one setting and a restart (the same few seconds as a normal install).
- **The data file stays as the fallback the whole time.** It receives a copy of every write.
- **A ZIP code cannot be sold twice.** In PostgreSQL the rule is enforced by the database itself.

Code: [src/lib/repositories](../src/lib/repositories) and [src/lib/persistence](../src/lib/persistence).

This guide never contains a password, a server address or an account number. `DATABASE_URL` is a password:
it goes in the server settings file and nowhere else.

---

## 1. Settings

They live in the server settings file (`/etc/ypnusa/app.env`, see [OPERATIONS.md](OPERATIONS.md) section 6).

| Setting | Values | What it does |
| --- | --- | --- |
| `DATABASE_URL` | a PostgreSQL connection address | Connects the site to the database. Without it the two settings below are ignored. |
| `DATABASE_CA_FILE` | path to a certificate file | Needed for Amazon RDS. The database's certificate is checked against this file. |
| `YPN_LEDGER_STORE` | `json` (default), `shadow`, `postgres` | Which store answers "is this ZIP code open?" |
| `YPN_SUBSCRIPTION_STORE` | `json` (default), `shadow`, `postgres` | Which store decides and records payments and ZIP code locks. |
| `YPN_ACCEPT_DATA_FILE_AS_TRUTH` | `1`, only in an emergency | Declares the data file's copy to be the truth and discards PostgreSQL's. See section 6. |

Optional: `DATABASE_POOL_SIZE` (default 5), `DATABASE_STATEMENT_TIMEOUT_MS` (default 5000),
`DATABASE_CONNECT_TIMEOUT_MS` (default 3000).

| Value | Who decides | The other store |
| --- | --- | --- |
| `json` | The data file. | PostgreSQL is not read or written. |
| `shadow` | The data file. | PostgreSQL receives a copy of every write, and the two are compared at start and every 5 minutes. A database outage does not fail a payment: the copy is made later. |
| `postgres` | PostgreSQL. | The data file receives a copy of every write. If the database cannot be reached, ZIP code checks and dashboards keep answering from that copy, and a payment event is refused so Stripe sends it again. |

Combinations that make no sense are corrected at start and logged (for example the ledger on `postgres` while
subscriptions are on `json`).

The tables are created automatically the first time the site starts with `DATABASE_URL` set.

---

## 2. Before you start (checklist)

Do not set `DATABASE_URL` until every line is true.

**Code**

- [ ] The build that contains this guide is live: `curl -s https://ypnus.com/api/health` shows a `database` section.
- [ ] `database.configured` is `false` and the site is healthy.

**Database**

- [ ] PostgreSQL 16, in the same region and private network as the web server. Not reachable from the internet.
- [ ] Its firewall (security group) allows port 5432 from the web server only.
- [ ] Storage encryption is on.
- [ ] Automatic backups are on, kept at least 7 days, with point-in-time restore.
- [ ] A database named for the app, owned by a login used only by the app. That login can create tables in it.
- [ ] The app's login can create the `btree_gist` extension, or it has been created once by the administrator login:
      `create extension if not exists btree_gist;`
- [ ] From the web server, the database answers: `pg_isready -h <address> -p 5432` (or a `psql` login).
- [ ] The certificate file is on the web server, readable by the app, for example `/etc/ypnusa/rds-ca.pem`
      (Amazon publishes one bundle for all regions).

**Data file**

- [ ] The newest backup under `/var/backups/ypnusa/hourly/` is less than 2 hours old.
- [ ] An off-server backup copy exists (`YPNUSA_BACKUP_S3_URI` is set), and one restore has been rehearsed.
- [ ] `storage.unavailable` is `false` and `storage.headroom` is `ok` in the health check.

**Watching it**

- [ ] Something checks `https://ypnus.com/api/health` at least every 5 minutes and alerts a person (section 5).
- [ ] You know how to read the app log: `sudo journalctl -u ypnusa --since "1 hour ago" | grep "\[persistence\]"`.

**Stripe**

- [ ] The Stripe webhook is healthy (no failing deliveries in the Stripe dashboard for the last 7 days).
- [ ] No marketing push or price change is planned for the day of steps 3 and 4.

---

## 3. Rollout, step by step

After each step, wait for the gate before taking the next one. Do not skip a step and do not take a step on a Friday.

| Step | `YPN_LEDGER_STORE` | `YPN_SUBSCRIPTION_STORE` | Stay here | Gate to move on |
| --- | --- | --- | --- | --- |
| 1. Connect | `json` | `json` | 1 day | `configured` and `ready` are `true` |
| 2. Shadow (dual-write) | `shadow` | `shadow` | 7 days, with at least one real payment | `parityClean` `true` at every check; `driftDetected`, `mirrorFailures`, `readMismatches`, `ledgerMismatches`, `unstorableRecords`, `refusedClaims` all `0` |
| 3. Ledger first | `postgres` | `shadow` | 3 to 5 days | Same as step 2, and `ledgerFallbacks` does not climb between restarts |
| 4. Subscriptions second | `postgres` | `postgres` | from here on | `parityClean` `true`; `writeFailures` `0`; a test purchase locked its ZIP code |

### Step 1: connect

1. Put the certificate file in place:

```bash
sudo curl -fsS -o /etc/ypnusa/rds-ca.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

```bash
sudo chmod 644 /etc/ypnusa/rds-ca.pem
```

2. Add to `/etc/ypnusa/app.env` (type the address in; never paste it anywhere else):

```
DATABASE_URL=postgres://<login>:<password>@<address>:5432/<database>
DATABASE_CA_FILE=/etc/ypnusa/rds-ca.pem
```

   A password with symbols must be URL-encoded. Leave `sslmode` out of the address.

3. Restart and check:

```bash
sudo systemctl restart ypnusa
```

```bash
curl -s https://ypnus.com/api/health
```

   Expect `"configured":true,"ready":true,"ledger":"json","subscriptions":"json"`. If `ready` stays `false`
   for more than a minute, read the log (the reason is on a `[persistence] database not ready` line). The site
   itself is unaffected: remove the two lines and restart to undo.

### Step 2: shadow (dual-write)

1. Add to `/etc/ypnusa/app.env`:

```
YPN_LEDGER_STORE=shadow
YPN_SUBSCRIPTION_STORE=shadow
```

2. Restart and check as above. The log shows `ready (ledger=shadow, subscriptions=shadow): N copied`.
3. Read the log once for `left work for a person`. It lists plans PostgreSQL could not store and ZIP codes
   two different customers both list. **Fix every one before step 4**: PostgreSQL will refuse to take over
   while any remain.
4. Check the health answer daily for 7 days against the gate.

### Step 3: ledger first

1. Change `YPN_LEDGER_STORE=postgres`. Leave `YPN_SUBSCRIPTION_STORE=shadow`.
2. Restart and check.
3. Spot-check 10 ZIP codes on `/check-zip` against the dashboard: 5 you know are sold, 5 you know are open.
4. Check the MCP endpoint answers the same (it uses the same ledger): ask the YPN USA connector for one sold and
   one open ZIP code.

### Step 4: subscriptions second

1. Confirm `parityClean` is `true` and `refusedClaims` and `unstorableRecords` are `0` right now.
2. Change `YPN_SUBSCRIPTION_STORE=postgres`.
3. Restart and check. The log shows `hand-over from json to postgres`. If it shows `hand-over to PostgreSQL
   refused`, the health answer has `"handoverBlocked":true` and payments are being refused: go back to step 3
   at once, fix the listed records, and try again later.
4. Make one real test purchase on a spare ZIP code and one cancellation. Confirm the ZIP code locks, then opens.
5. Confirm `writeFailures` is `0` and `latencyMs.postgresWrite.maxMs` is under 1000.

---

## 4. The health answer

```bash
curl -s https://ypnus.com/api/health
```

| Field | Healthy | What it means |
| --- | --- | --- |
| `configured` | `true` | `DATABASE_URL` is set. |
| `ready` | `true` | Connected, tables in place, stores brought in line since the last start. It turns `false` only when the connection is lost, and the app reconnects by itself (it retries every 10 seconds). |
| `ledger`, `subscriptions` | the step you are on | The values in use. If they differ from what you set, the log says why. |
| `handoverPending` | `false` | `true`: PostgreSQL was in charge and its copy has not been brought back yet, so payment events are refused until the database is reachable. See section 6. |
| `handoverBlocked` | `false` | `true`: the switch to PostgreSQL was refused because some records could not be copied. Go back a step. |
| `parityClean` | `true` | Both stores hold the same plans and the same (ZIP code, holder) pairs at the last comparison. |
| `parityCheckedAt` | within 10 minutes | When they were last compared. Comparisons run at start and every 5 minutes. |
| `parityMismatches` | `0` | How many records or ZIP code holders differ right now. The log lists them. |
| `driftDetected` | `0` | Differences a comparison found since the last start. They were repaired from the store in charge, but each one means a copy went wrong: find out why. |
| `mirrorFailures` | `0` | Copies to the other store that did not happen when the write did. Repaired automatically; a climbing number means the database is unstable. |
| `writeFailures` | `0` | Payment events refused because the store in charge could not be used. Stripe sends each again. |
| `readMismatches`, `ledgerMismatches` | `0` | Shadow mode: times the two stores answered the same question differently. |
| `ledgerFallbacks` | steady | Times a ZIP code check was answered from the data file because PostgreSQL had no fresh answer. A few right after a restart are normal. |
| `unstorableRecords`, `refusedClaims` | `0` | Plans PostgreSQL could not store, and ZIP codes left with an earlier holder, at the last copy. Each needs a person. |
| `duplicateStripeSubscriptions` | `0` | Stripe subscriptions that appear on more than one plan. Must be `0` before the uniqueness rule is added. |
| `latencyMs.postgresWrite` | `avgMs` under 100 | Time for PostgreSQL to decide and store a payment. |
| `latencyMs.postgresRead` | `avgMs` under 50 | Time to read a plan in the payment path (step 4 only). |
| `latencyMs.mirror` | `avgMs` under 1500 | Time to copy a write to the other store. In step 4 this is the data file save. |

---

## 5. Monitoring

Nothing alerts by itself: set up one of these before step 2.

- **Simplest:** an uptime monitor with a keyword check on `https://ypnus.com/api/health`, every 5 minutes, alerting
  when the page does not contain `"parityClean":true` (steps 2 to 4) and when it contains `"handoverPending":true`
  or `"handoverBlocked":true`.
- **On AWS:** the database's own alarms for CPU, free storage, connections and "instance not available".

| What to watch | Where | Alert when | First action |
| --- | --- | --- | --- |
| Dual-write failures | `mirrorFailures` | above 0 and climbing | Check the database's status. Nothing a visitor sees depends on it in steps 2 and 3. |
| Write latency | `latencyMs.postgresWrite` | `avgMs` over 500, or `maxMs` over 3000 | Check database CPU and connections. Stripe expects a quick answer to every webhook. |
| Read latency | `latencyMs.postgresRead` | `avgMs` over 250 | Same. |
| Copy latency | `latencyMs.mirror` | `avgMs` over 3000 in step 4 | The data file is getting large: see `storage.sizeMb`. |
| Drift | `driftDetected`, `parityClean` | `driftDetected` above 0, or `parityClean` `false` twice in a row | Read the log line that lists the differences. Do not take the next step. |
| Failed comparisons | `readMismatches`, `ledgerMismatches`, `parityCheckedAt` | either above 0, or `parityCheckedAt` older than 15 minutes | The second means comparisons are not running: check `ready`. |
| PostgreSQL availability | `ready`, `writeFailures`, `ledgerFallbacks` | `ready` `false` for 2 checks; `writeFailures` above 0 | Section 6. |
| Refused hand-over | `handoverPending`, `handoverBlocked` | either `true` | Section 6. Payments are being refused. |
| Stripe | Stripe dashboard, webhook deliveries | any delivery failing for over 1 hour | The app is refusing events: find out which of the above is the cause. |

---

## 6. Rolling back

Rolling back is setting the previous step's values and restarting. At start, the store that was in charge is
copied in full to the other before the newly chosen store decides anything.

### When to roll back

| You are on | Roll back when | To |
| --- | --- | --- |
| Step 4 | `handoverBlocked` is `true`; or `writeFailures` climbs for 15 minutes while `ready` is `true`; or `latencyMs.postgresWrite.avgMs` stays over 2000 for 15 minutes; or a payment locked the wrong ZIP code or none | Step 3 |
| Step 3 | A ZIP code check gives a wrong answer you can reproduce; or `ledgerFallbacks` climbs for 30 minutes while `ready` is `true`; or `driftDetected` keeps rising | Step 2 |
| Step 2 | `mirrorFailures` climbs for a day; or `unstorableRecords` or `refusedClaims` cannot be fixed yet | Step 1 |
| Step 1 | `ready` cannot be made `true` | Remove `DATABASE_URL` |

After any rollback, confirm `parityClean` is `true` (or `null` on `json`) and `handoverPending` is `false`.

### If the database is down while PostgreSQL is in charge (step 4)

The site, ZIP code checks and dashboards keep working from the data file's copy. Payment events are refused and
Stripe sends each again for up to three days.

1. **First choice: wait for the database.** Nothing is lost. When it returns the app reconnects within seconds.
2. **Rolling back to step 3 does not make payments flow while the database is down.** The data file refuses to
   decide until PostgreSQL's copy has been brought over, because its own copy may be older. The health answer
   shows `"handoverPending":true`. When the database returns, the copy happens and payments resume by themselves.
3. **Only if the database is lost for good:** restore it from its own backups first if you can (point-in-time
   restore, then keep the same settings). If you cannot, set the previous step's values and add
   `YPN_ACCEPT_DATA_FILE_AS_TRUTH=1`. This declares the data file's copy to be the truth. Any payment whose copy
   to the data file had failed (`mirrorFailures` above 0 before the outage) is lost from the app and must be
   re-entered from the Stripe dashboard. Remove the setting again once `handoverPending` is `false`.

Do not delete `persistence-authority.json` in the data folder. It is how the app remembers which store was last
in charge.

---

## 7. Restoring a data file backup

Restoring `store.json` (see [OPERATIONS.md](OPERATIONS.md) section 5) rolls the data file back in time. Do it only
with a developer, and know what happens to plans and ZIP code locks:

| Step you are on | After the restore |
| --- | --- |
| 1 | Nothing special. |
| 2 or 3 | PostgreSQL still holds plans newer than the backup. `parityClean` turns `false` and the log lists them under `onlyInPostgres`. They are real payments the restore removed from the data file: re-enter them, or restore a newer backup. In step 3, their ZIP codes still show as locked, which is correct. |
| 4 | PostgreSQL is the record for plans, so at the next start its plans are copied back over the restored ones. The restore rolls back everything except plans and ZIP code locks. |

---

## 8. The MCP endpoint and other callers

| Caller | What it uses | Affected by Phase 1 |
| --- | --- | --- |
| MCP `check_zip_availability`, `check_zip_availability_batch`, `find_nearby_open_zips` | The ZIP code ledger, through the same in-memory copy the website uses | Moves with step 3. Read-only. Never waits on the database. |
| MCP `get_zip_lock_info`, `get_cerebro_overview` | Pricing and fixed text | No |
| MCP `ask_cerebro` | Chat sessions and leads in the data file; its ZIP code tool uses the ledger | The ZIP code answers move with step 3; the rest in Phase 2 |
| `/api/territory/check`, `/check-zip`, ZIP pages, Cerebro's ZIP tool | The same ledger | Moves with step 3 |
| Stripe webhooks, "pick a ZIP code" in the dashboard | The subscription repository | Moves with step 4 |
| Lead routing, dashboards, revenue reports | The data file's copy of plans | Phase 2 |

A burst of MCP calls is answered from memory: the ledger is reloaded after each payment and every 10 seconds,
never once per call. An answer can therefore be up to 10 seconds behind a payment made on another server; the
payment itself is always decided inside the database. No MCP tool writes plans or ZIP code locks.

---

## 9. What Phase 1 does not do

- Borrower leads, accounts, loan officers, chats and consent records stay in the data file. They move in Phase 2.
- The site still runs on one server. The per-subscription lock that keeps two Stripe events from overwriting each
  other lives inside that one process; running two servers needs it moved into the database (Phase 2).
- The data file is not removed.

---

## 10. For developers

- Callers use `subscriptionRepository()` and `territoryLedger()` from `src/lib/repositories`. Anything that reads
  a plan and then writes it wraps both in `withKeyedLock(subscriptionLockKey(...))`.
- `src/lib/repositories/contract.test.ts` runs one set of behaviour tests against both stores. Any change to who
  gets a ZIP code must pass on both.
- `src/lib/mcp/mcp-postgres.test.ts` runs the MCP ZIP code tools in every mode, through an outage and a burst.
- Schema changes go in `src/lib/persistence/schema.ts` as a new entry. Never edit one that has shipped.
- Tests use an in-process PostgreSQL, so `npm test` needs no database. The tests that need two real connections
  at once (`postgres-concurrency.test.ts`) run when `TEST_DATABASE_URL` points at a PostgreSQL server; CI starts one.
- The older `migrations/001-003*.sql` files are an earlier draft of the whole schema. They were never applied and
  are not used by Phase 1.
