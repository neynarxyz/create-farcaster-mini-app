#!/usr/bin/env node

import { init } from './init.js';

init().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
