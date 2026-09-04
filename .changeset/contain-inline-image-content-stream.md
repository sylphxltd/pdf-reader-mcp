---
"@sylphx/citra": patch
---

Contain malformed inline-image (`BI`/`ID`/`EI`) content-stream failures in PDF text extraction so a damaged or adversarial page returns a structured `invalid content stream (page N)` extraction error instead of aborting the native server.
