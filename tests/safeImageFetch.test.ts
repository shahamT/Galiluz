import { describe, it, expect } from 'vitest'
import { isPrivateOrReservedAddress } from '~/server/utils/safeImageFetch'

// The IP classifier is the SSRF guard's error-prone core. It must return true
// (block) for every non-public-unicast address and false ONLY for routable public
// addresses. It fails closed on anything it can't positively classify.
describe('isPrivateOrReservedAddress — IPv4', () => {
  it('allows public unicast addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '142.250.200.46', '172.15.0.1', '172.32.0.1', '100.63.0.1', '100.128.0.1']) {
      expect(isPrivateOrReservedAddress(ip)).toBe(false)
    }
  })

  it('blocks loopback, private, link-local, CGNAT and reserved ranges', () => {
    for (const ip of [
      '127.0.0.1', '127.255.255.255', // loopback
      '10.0.0.1', '10.255.255.255', // 10/8
      '172.16.0.1', '172.31.255.255', // 172.16/12
      '192.168.0.1', '192.168.255.255', // 192.168/16
      '169.254.169.254', '169.254.0.1', // link-local incl. cloud metadata
      '100.64.0.1', '100.127.255.255', // CGNAT
      '0.0.0.0', '0.255.255.255', // this-host
      '192.0.0.1', '192.0.2.5', '192.88.99.1', // protocol assignments / TEST-NET-1 / 6to4
      '198.18.0.1', '198.19.255.255', '198.51.100.1', '203.0.113.1', // benchmarking / TEST-NETs
      '224.0.0.1', '239.255.255.255', // multicast
      '240.0.0.1', '255.255.255.255', // reserved / broadcast
    ]) {
      expect(isPrivateOrReservedAddress(ip), ip).toBe(true)
    }
  })
})

describe('isPrivateOrReservedAddress — IPv6', () => {
  it('allows public IPv6 unicast', () => {
    for (const ip of ['2001:4860:4860::8888', '2606:4700:4700::1111', '::ffff:8.8.8.8', '64:ff9b::8.8.8.8']) {
      expect(isPrivateOrReservedAddress(ip), ip).toBe(false)
    }
  })

  it('blocks loopback / unspecified / ULA / link-local / site-local / multicast', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fe80::dead:beef', 'fc00::1', 'fd12:3456::1', 'fec0::1', 'feff::1', 'ff02::1', 'ff00::1']) {
      expect(isPrivateOrReservedAddress(ip), ip).toBe(true)
    }
  })

  it('decodes 6to4 (2002::/16) and judges the embedded IPv4', () => {
    expect(isPrivateOrReservedAddress('2002:7f00:0001::1')).toBe(true) // wraps 127.0.0.1
    expect(isPrivateOrReservedAddress('2002:0a00:0001::1')).toBe(true) // wraps 10.0.0.1
    expect(isPrivateOrReservedAddress('2002:0808:0808::1')).toBe(false) // wraps public 8.8.8.8
  })

  it('blocks IPv4-mapped / compatible / NAT64 wrappers around private v4', () => {
    for (const ip of [
      '::ffff:127.0.0.1', '::ffff:7f00:1', // mapped loopback (dotted + hextet forms)
      '::ffff:10.0.0.1', '::ffff:169.254.169.254', // mapped private / metadata
      '::ffff:192.168.1.1',
      '::127.0.0.1', // deprecated IPv4-compatible
      '64:ff9b::127.0.0.1', '64:ff9b::169.254.169.254', // NAT64 wrapping private/metadata
    ]) {
      expect(isPrivateOrReservedAddress(ip), ip).toBe(true)
    }
  })
})

describe('isPrivateOrReservedAddress — fail closed', () => {
  it('treats non-IP strings and garbage as unsafe (caller must DNS-resolve first)', () => {
    for (const s of ['example.com', 'localhost', '', 'not-an-ip', '999.999.999.999', 'fe80::zzzz']) {
      expect(isPrivateOrReservedAddress(s), s).toBe(true)
    }
  })
})
