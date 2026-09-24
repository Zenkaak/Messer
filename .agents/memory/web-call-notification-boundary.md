---
name: Web call notification boundary
description: Platform boundary for GSM World call alerts and native full-screen call UI
---

GSM World currently runs as a React/Vite web app and installable PWA. It can deliver high-priority Android web push notifications that appear over other apps and open the call sheet, but it cannot request WhatsApp-style native full-screen call intents.

**Why:** Android reserves full-screen call UI, lock-screen call controls, and system call integration for native applications with OS-level permissions; browser/PWA APIs do not expose that capability.

**How to apply:** Keep web push as the supported cross-app alert path. If true full-screen incoming-call UI is required, add a native Android wrapper with notification full-screen intent/call permissions rather than trying to solve it with React overlay CSS.