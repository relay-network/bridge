# Overview

Deploy XMTP adapters for HTTP APIs.

# Architecture Overview

**API Server**

A simple HTTP server that is responsible for managing the state of the system.
For example, you use the API server to sign up for the platform.

**Bridge Instances**

A bridge instance is an XMTP client that is configured to respond to messages
from various addresses in different ways. Right now, there are three message
handlers:

- forward proxy (listen to XMTP messages and forward them to an HTTP endpoint)
- reverse proxy (listen to XMTP messages from the API server's XMTP identity
  and then forward them to their destination XMTP identity).
- canary (listen to XMTP messages from a specially-designated XMTP identity and
  call the canary endpoint on the API server).

**Auxiliary Components**

- Postgres database for storing state
- Nginx for ingress
- LetsEncrypt (using nginx-proxy) for TLS automation

# Project Overview

The entire project, from development to production, is designed in such a way
that you can step through the development process, make changes, validate the
changes, open a PR, merge changes, and deploy to production without ever needing
to ask anyone for help (in theory 😁, please ask questions). Start with the next section.

# Development

`npm run test:dev` and follow the error messages.

# Validate Changes

If the GH workflow defined in `.github/analyze.yaml` passes, then you're good to
request a code review.

# DevOps

- The goal is for everything to fail very fast and very loudly. If you're
  running the system and don't see any errors, you should have very high
  confidence that everything is working. The way we will accomplish this is by
  being extremely explicit about what are the system's entrypoints. We will have
  some very strong invariants that we uphold for all entrypoints.
- Every script needed to run the system is in `package.json`. These scripts are
  the project's "entrypoints".
- Every script sources `shell/env.sh` to get its environment variables. This env
  file should have tons of documentation, error handling, validation, and
  testing.
- There is a corresponding `env.ts` source file. This source file should be
  extremely obnoxious in the same way that `env.sh` is. `env.ts` must correspond
  to each other. We need to test this correspondence.
- There should be a primary test file for each environment. Right now, that
  means we have:
  - dev.test.ts (for validating a dev environment)
  - docker.test.ts (for validating a docker environment)
  - prod.api.test.ts (for validating the prod API server)
  - prod.bridge.test.ts (for validating the prod bridge instances)

# Effects, Services, and Events

The TypeScript compiler provides lots of guarantees about the correctness of our
code. We define an "effect" as any part of the system that is not covered by the
TypeScript compiler. One way to think about an effect is it's a part of the
system that is likely to fail. We want to be extremely explicit about what are
the effects in our system and how we handle them. An effect has the following
shape:

```typescript
type Effect = {
  app: string;
  env: string;
  instance: string;
  service: string;
  feature: string;
  event: string;
  id: string;
  metadata: string;
};
```

We manage effects by defining services that wrap a bunch of effects. Most of
the time, these services are represented by some library or sdk (for example,
the `prisma` library wraps all of the effects related to the database). We
heavily instrument every service in such a way that we have a very high
resolution view into the effects that are happening in the system.

For every service we are take extreme care to instrument the following events
and their failure modes:

- boot
- register
- request
- handle
- response
- success
