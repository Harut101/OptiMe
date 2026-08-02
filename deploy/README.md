# Single-server deployment examples

These files are provider-neutral examples for the first OptiMe release. They do
not contain production credentials and are not a substitute for the production
deployment runbook.

- `docker-compose.production.example.yml` runs one immutable API image on
  loopback port `3000`, with a read-only filesystem, dropped capabilities, and
  graceful shutdown.
- `nginx/optime-api.conf.example` terminates TLS, proxies to the API, applies a
  bounded edge rate limit, and logs the server-owned request ID without query
  strings.

Keep the real `.env.production` outside the repository with owner-only read
permissions. Replace `api.example.com` and certificate paths before enabling the
Nginx site. Set `TRUST_PROXY_HOPS=1` when Nginx is the only trusted proxy in front
of the API.

The production API container never runs Prisma migrations automatically. Build
and run the `migrator` target once after a verified backup and before starting
the new `runtime` target.
