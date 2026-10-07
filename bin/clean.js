#!/usr/bin/env node

// Build cleanup never touches the user's profile, downloads or app backups.
const fs = require('fs')
fs.rmSync('build', { recursive: true, force: true })
console.log('Removed generated build files. User data and dist/backups were preserved.')
