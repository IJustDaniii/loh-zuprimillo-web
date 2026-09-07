import { runNode } from './run-command.mjs';

runNode('scripts/build.mjs');
runNode('node_modules/wrangler/bin/wrangler.js', ['deploy']);
