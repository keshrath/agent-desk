import { describe, it, expect } from 'vitest';

describe('IPC security', () => {
  describe('command name validation', () => {
    const validPattern = /^[a-zA-Z0-9._-]+$/;

    it.each([
      ['node', true],
      ['python3', true],
      ['claude.exe', true],
      ['my-tool', true],
      ['my_tool', true],
      ['foo & bar', false],
      ['foo; rm -rf /', false],
      ['foo | cat', false],
      ['$(whoami)', false],
      ['foo`id`', false],
      ['foo > /dev/null', false],
      ['foo\nbar', false],
      ['', false],
    ])('validates "%s" as %s', (cmd, expected) => {
      expect(validPattern.test(cmd)).toBe(expected);
    });
  });

  describe('URL protocol validation', () => {
    function isAllowedUrl(url: string): boolean {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }

    it.each([
      ['http://localhost:3421', true],
      ['https://example.com', true],
      ['file:///etc/passwd', false],
      ['javascript:alert(1)', false],
      ['ftp://evil.com', false],
      ['not-a-url', false],
    ])('validates "%s" as %s', (url, expected) => {
      expect(isAllowedUrl(url)).toBe(expected);
    });
  });

  describe('session ID sanitization', () => {
    const sanitize = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, '');

    it.each([
      ['abc-123-def', 'abc-123-def'],
      ['../../../etc/passwd', 'etcpasswd'],
      ['valid-uuid-1234', 'valid-uuid-1234'],
      ['foo/bar', 'foobar'],
      ['foo\\bar', 'foobar'],
    ])('sanitizes "%s" to "%s"', (input, expected) => {
      expect(sanitize(input)).toBe(expected);
    });
  });
});
