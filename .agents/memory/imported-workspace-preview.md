---
name: Imported workspace preview
description: Runtime checks for imported Messer workspaces and preserved catalog data
---

Imported workspaces may register artifact workflows with stale absolute working directories; verify the managed workflow is serving the current artifact before diagnosing application behavior.

**Why:** An imported repository can build successfully while its preview still runs an older bundle or points at a different checkout.

**How to apply:** Restart the managed artifact workflow after source/build changes, then check the API through its `/api` routes. Do not push a schema or seed an empty database when preserving an existing catalog is a requirement; treat missing base relations as an environment/data provisioning issue.