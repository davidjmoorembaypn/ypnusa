# Moving to PostgreSQL, Phase 1: paid plans and the ZIP code ledger

Phase 1 moves two things from the single data file (`store.json`) to a PostgreSQL database: the paid plans
(subscriptions) and the list of which ZIP code is locked by whom. Everything else stays in the data file for now.

It is built so that:

- **Nothing changes until a setting is switched.** With no database configured the site runs exactly as before.
- **There is no downtime and no data freeze.** Each step is one setting and a restart (the same few seconds as a
  normal install).
- **The data file stays as the fallback the whole time.** It receives a copy of every write, and rolling back is
  setting the value back.
- **A ZIP code cannot be sold twice.** In PostgreSQL the rule is enforced by the database itself, not only by the app.

Code: [src/lib/repositories](../src/lib/repositories) and [src/lib/persistence](../src/lib/persistence).

---

## 1. The three settings

They live in the server settings file (`/etc/ypnusa/app.env`, see [OPERATIONS.md](OPERATIONS.md) section 6).

| Setting | Values | What it does |
| --- | --- | --- |
| `DATABASE_URL` | a PostgreSQL connection address | Connects the site to the database. **Treat it as a password: it is never put in GitHub, a chat, an email or a document.** Without it the two settings below are ignored. |
| `YPN_LEDGER_STORE` | `json` (default), `shadow`, `postgres` | Which store answers "is this ZIP code open?" |
| `YPN_SUBSCRIPTION_STORE` | `json` (default), `shadow`, `postgres` | Which store decides and records payments and ZIP code locks. |

Optional: `DATABASE_CA_FILE` (path to the certificate bundle, needed for Amazon RDS), `DATABASE_POOL_SIZE`
(default 5), `DATABASE_STATEMENT_TIMEOUT_MS` (default 5000).

What the values mean:

| Value | Who decides | The other store |
| --- | --- | --- |
| `json` | The data file. | PostgreSQL is not read or written. |
| `shadow` | The data file. | PostgreSQL receives a copy of every write, and its answers are compared with the data file's in the background. A database problem never affects a visitor or a payment. |
| `postgres` | PostgreSQL. | The data file receives a copy of every write. If the database cannot be reached, ZIP code checks and dashboards keep answering from that copy, and a payment event is refused so Stripe sends it again later. |

Combinations that make no sense are corrected at start and logged (for example the ledger on `postgres` while
subscriptions are on `json`).

The tables are created automatically the first time the site starts with `DATABASE_URL` set. There is no script
to run on the server.

---

## 2. The steps, in order

After each step, wait for the check to pass before taking the next one. Do not skip a step.

| Step | `YPN_LEDGER_STORE` | `YPN_SUBSCRIPTION_STORE` | Stay here | Check before moving on |
| --- | --- | --- | --- | --- |
| 1. Connect | `json` | `json` | 1 day | `database.configured` and `database.ready` are `true` |
| 2. Shadow | `shadow` | `shadow` | 7 days, including at least one real payment | `parityClean` is `true`; `mirrorFailures`, `readMismatches`, `ledgerMismatches` are `0` |
| 3. Ledger first | `postgres` | `shadow` | 3 to 5 days | same as step 2, and `ledgerFallbacks` is not climbing |
| 4. Subscriptions second | `postgres` | `postgres` | from here on | `parityClean` is `true`; `writeFailures` is `0` |

To take a step:

1. Edit `/etc/ypnusa/app.env` and set the two values for that step.
2. Restart the site:

```bash
sudo systemctl restart ypnusa
```

3. Check it:

```bash
curl -s https://ypnus.com/api/health
```

The `database` part of the answer:

| Field | Healthy value | What it means |
| --- | --- | --- |
| `configured` | `true` | `DATABASE_URL` is set. |
| `ready` | `true` | Connected, tables in place, and the two stores brought in line since the last restart. `false` for more than a minute means the database cannot be reached. |
| `ledger`, `subscriptions` | the step you are on | The values in use. If they differ from what you set, the server log says why. |
| `parityClean` | `true` | Both stores hold the same plans and the same locked ZIP codes. `null` in step 1. |
| `parityMismatches` | `0` | How many records or ZIP codes differ. The server log lists them. |
| `mirrorFailures` | `0` | Copies to the other store that failed since the last restart. They are re-copied automatically; a number that keeps climbing means the database is unstable. |
| `writeFailures` | `0` | Payment events refused because PostgreSQL was in charge and unreachable. Stripe sends each one again. |
| `readMismatches`, `ledgerMismatches` | `0` | Times the two stores gave different answers to the same question in shadow mode. |
| `ledgerFallbacks` | `0`, or not climbing | Times a ZIP code check was answered from the data file because PostgreSQL had no fresh answer. |

Server log lines from this work start with `[persistence]`:

```bash
sudo journalctl -u ypnusa --since "1 hour ago" | grep "\[persistence\]"
```

---

## 3. Rolling back

Rolling back is setting the previous step's values and restarting. Nothing is lost in either direction: at start,
the store that was in charge is copied in full to the other one before the newly chosen store decides anything.

| You are on | Go back to | When |
| --- | --- | --- |
| Step 4 | Step 3 (`postgres` / `shadow`) | Payments are being refused, or `writeFailures` keeps climbing. |
| Step 3 | Step 2 (`shadow` / `shadow`) | ZIP code answers look wrong, or `ledgerFallbacks` keeps climbing. |
| Step 2 | Step 1 (`json` / `json`) | `mirrorFailures` keeps climbing. Nothing a visitor sees depends on step 2. |
| Any step, database gone for good | remove `DATABASE_URL` | The data file has a copy of every write and takes over alone. |

After a rollback, run the health check and confirm `parityClean` is `true` (or `null` on `json`).

The hourly, daily and before-install backups of the data file continue unchanged through every step
([OPERATIONS.md](OPERATIONS.md) section 5), and they still contain the plans and ZIP code locks.

---

## 4. What Phase 1 does not do

- Borrower leads, accounts, loan officers and chats stay in the data file. They move in Phase 2.
- Dashboards and reports that list plans still read the data file's copy. That copy is updated on every write,
  so they stay correct on the one server the site runs on today.
- The site still runs on one server. Running two at once needs Phase 2.
- The data file is not removed. It is removed only after Phase 2, once every reader has moved.

---

## 5. For developers

- Callers use the interfaces in `src/lib/repositories/types.ts` (`SubscriptionRepository`,
  `TerritoryLedgerRepository`) through `subscriptionRepository()` and `territoryLedger()`. The payment path
  (`src/lib/fulfillment.ts`, `claimReplacementZip`) already does.
- `src/lib/repositories/contract.test.ts` runs one set of behaviour tests against both stores. Any change to who
  gets a ZIP code must pass on both.
- Schema changes go in `src/lib/persistence/schema.ts` as a new entry. Never edit one that has shipped.
- Tests use an in-process PostgreSQL, so `npm test` needs no database. The tests that need two real connections
  at once (`postgres-concurrency.test.ts`) run when `TEST_DATABASE_URL` points at a PostgreSQL server; CI starts one.
- The older `migrations/001-003*.sql` files are an earlier draft of the whole schema. They were never applied and
  are not used by Phase 1.
