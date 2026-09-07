import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

describe('Cloudflare build scripts', () => {
  it('does not depend on PowerShell-only control flow', () => {
    expect(packageJson.scripts.build).toBe('node scripts/build.mjs');
    expect(packageJson.scripts.deploy).toBe('node scripts/deploy.mjs');
    expect(packageJson.scripts.check).toBe('node scripts/check.mjs');
    expect(Object.values(packageJson.scripts).join(' ')).not.toContain('LASTEXITCODE');
  });
});
