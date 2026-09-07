import { runNode } from './run-command.mjs';

runNode('node_modules/typescript/bin/tsc', ['-b']);
runNode('node_modules/vite/bin/vite.js', ['build']);
