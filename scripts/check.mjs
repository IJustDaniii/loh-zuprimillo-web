import { runNode } from './run-command.mjs';

runNode('node_modules/typescript/bin/tsc', ['-b', '--pretty', 'false']);
runNode('node_modules/vitest/vitest.mjs', ['run']);
runNode('scripts/build.mjs');
