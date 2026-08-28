---
"@sylphx/citra": patch
---

Contain malformed CFF Custom-encoding failures in PDF text extraction so a
malicious or damaged Type1C font returns a structured extraction error instead
of aborting the native server.
