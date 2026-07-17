---
"@sylphx/pdf-reader-mcp": patch
---

Fix SSRF guard bypass via IPv6 transition addresses (NAT64 / 6to4 / Teredo).

`isPrivateIpv6` now expands IPv6 literals to hextets and blocks:

- NAT64 well-known `64:ff9b::/96` (RFC 6052) when the embedded IPv4 is non-public
- NAT64 local-use `64:ff9b:1::/48` (RFC 8215) entirely
- 6to4 `2002::/16` (RFC 3056) when the embedded IPv4 is non-public
- Teredo `2001:0::/32` (RFC 4380) entirely
- documentation `2001:db8::/32` and discard-only `100::/64`

Regression coverage for GHSA-f3xw-ff5r-rj7c (reported by tonghuaroot).
