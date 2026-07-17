//! SSRF denylist for URL PDF loading (aligned with GHSA-f3xw-ff5r-rj7c intent).

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

fn is_private_ipv4(ip: Ipv4Addr) -> bool {
    let o = ip.octets();
    o[0] == 10
        || o[0] == 127
        || o[0] == 0
        || (o[0] == 172 && (16..=31).contains(&o[1]))
        || (o[0] == 192 && o[1] == 168)
        || (o[0] == 169 && o[1] == 254)
        || (o[0] == 100 && (64..=127).contains(&o[1]))
        || o[0] >= 224
}

fn hextets_to_ipv4(hi: u16, lo: u16) -> Ipv4Addr {
    Ipv4Addr::new(
        ((hi >> 8) & 0xff) as u8,
        (hi & 0xff) as u8,
        ((lo >> 8) & 0xff) as u8,
        (lo & 0xff) as u8,
    )
}

fn is_private_ipv6(ip: Ipv6Addr) -> bool {
    let s = ip.segments();
    // :: and ::1
    if ip.is_unspecified() || ip.is_loopback() {
        return true;
    }
    // ULA fc00::/7
    if (s[0] & 0xfe00) == 0xfc00 {
        return true;
    }
    // link-local fe80::/10
    if (s[0] & 0xffc0) == 0xfe80 {
        return true;
    }
    // multicast ff00::/8
    if (s[0] & 0xff00) == 0xff00 {
        return true;
    }
    // IPv4-mapped ::ffff:0:0/96
    if s[0] == 0 && s[1] == 0 && s[2] == 0 && s[3] == 0 && s[4] == 0 && s[5] == 0xffff {
        return is_private_ipv4(hextets_to_ipv4(s[6], s[7]));
    }
    // IPv4-compatible ::/96
    if s[0] == 0 && s[1] == 0 && s[2] == 0 && s[3] == 0 && s[4] == 0 && s[5] == 0 {
        return is_private_ipv4(hextets_to_ipv4(s[6], s[7]));
    }
    // NAT64 well-known 64:ff9b::/96
    if s[0] == 0x64 && s[1] == 0xff9b && s[2] == 0 && s[3] == 0 && s[4] == 0 && s[5] == 0 {
        return is_private_ipv4(hextets_to_ipv4(s[6], s[7]));
    }
    // NAT64 local-use 64:ff9b:1::/48
    if s[0] == 0x64 && s[1] == 0xff9b && s[2] == 1 {
        return true;
    }
    // 6to4 2002::/16
    if s[0] == 0x2002 {
        return is_private_ipv4(hextets_to_ipv4(s[1], s[2]));
    }
    // Teredo 2001:0::/32
    if s[0] == 0x2001 && s[1] == 0 {
        return true;
    }
    // documentation 2001:db8::/32
    if s[0] == 0x2001 && s[1] == 0xdb8 {
        return true;
    }
    // discard-only 100::/64
    if s[0] == 0x100 && s[1] == 0 && s[2] == 0 && s[3] == 0 {
        return true;
    }
    false
}

pub fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_private_ipv4(v4),
        IpAddr::V6(v6) => is_private_ipv6(v6),
    }
}

pub fn assert_host_not_private(host: &str) -> Result<(), String> {
    let host = host.trim().trim_matches(|c| c == '[' || c == ']');
    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_private_ip(ip) {
            return Err(format!(
                "URL host '{host}' resolves to a non-public address (SSRF protection)."
            ));
        }
        return Ok(());
    }
    // DNS: resolve all addresses
    use std::net::ToSocketAddrs;
    let addrs = (host, 0u16)
        .to_socket_addrs()
        .map_err(|_| format!("URL host '{host}' could not be resolved."))?;
    let mut any = false;
    for addr in addrs {
        any = true;
        if is_private_ip(addr.ip()) {
            return Err(format!(
                "URL host '{host}' resolves to a non-public address (SSRF protection)."
            ));
        }
    }
    if !any {
        return Err(format!("URL host '{host}' resolved to no addresses."));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv6Addr;

    #[test]
    fn blocks_nat64_metadata() {
        let ip: Ipv6Addr = "64:ff9b::a9fe:a9fe".parse().unwrap();
        assert!(is_private_ipv6(ip));
    }

    #[test]
    fn blocks_loopback_v4() {
        assert!(is_private_ipv4(Ipv4Addr::new(127, 0, 0, 1)));
        assert!(is_private_ipv4(Ipv4Addr::new(169, 254, 169, 254)));
    }

    #[test]
    fn allows_public_v4() {
        assert!(!is_private_ipv4(Ipv4Addr::new(8, 8, 8, 8)));
    }
}
