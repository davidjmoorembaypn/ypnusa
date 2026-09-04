# Hands-off operations model

How Claude should operate on this repo day to day.

## Current state

- PR #41 carries the app.ypnus.com AI Assistant foundation (three modes:
  public site, MLO dashboard, lead qualification), the invizo WordPress MCP
  server setup, and Vercel reference cleanup.
- ypnus.com's public chatbot remains Meow Apps/AI Engine + OpenAI on
  WordPress, unchanged and not duplicated by this repo.
- app.ypnus.com is the home for the new custom assistant; it is not wired to
  replace Meow on ypnus.com.

## Default posture: app-only, low-risk

- Prefer code/doc changes inside this repo over anything touching live
  infrastructure.
- Guide the user through small tasks with AI assistance rather than handing
  them a manual runbook, when a code-level alternative exists.
- Never ask the user to manually configure webhooks, Hostinger deployment,
  DNS, env vars, or server settings unless there is no other way to make
  progress.

## Requires explicit user approval before acting

- Any deployment or redeploy.
- Any Hostinger account/server change.
- Any change to the ypnus.com WordPress site or its Meow/OpenAI chatbot.
- Any webhook setup or change.
- Any database/schema migration.
- Any production environment variable change.

## When user action is unavoidable

Provide a **User Action Card**: a short block naming exactly what to do,
where (which panel/setting), and why — not a long manual procedure.

Example shape:

> **User Action Card**
> - **What:** Add `ANTHROPIC_API_KEY` to the app's environment
> - **Where:** Hostinger hPanel → Node.js app → Environment variables
> - **Why:** Enables real AI replies instead of the canned "not configured" reply
