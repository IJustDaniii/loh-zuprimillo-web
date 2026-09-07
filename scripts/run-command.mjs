import { spawnSync } from 'node:child_process';

/**
 * Run a Node-based CLI without relying on PowerShell, sh, or Windows .cmd shims.
 */
export function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`Could not start ${script}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
