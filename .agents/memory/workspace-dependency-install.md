---
name: Workspace dependency install
description: Dependency installation behavior for the imported multi-package workspace.
---

When validating the web and API artifacts, a full workspace install can be blocked by the unrelated API code-generation package. Install the web, API, database, and generated client/schema workspace filters instead of bypassing the package firewall.

**Why:** The imported workspace contains packages that are not needed to run the app, and the blocked package can prevent all required runtime dependencies from being installed.

**How to apply:** Keep the package firewall and release-age protections enabled. Use filtered workspace installation for app verification; include the code-generation package only when actually regenerating clients.