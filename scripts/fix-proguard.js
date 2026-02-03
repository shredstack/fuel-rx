/**
 * Patches node_modules Capacitor plugin build.gradle files that reference
 * the deprecated 'proguard-android.txt' (rejected by AGP 9+).
 * Runs automatically via the "postinstall" npm script.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nodeModules = path.join(__dirname, '..', 'node_modules');

try {
  const files = execSync(
    `grep -rl "proguard-android.txt" "${nodeModules}" --include="build.gradle"`,
    { encoding: 'utf-8' }
  )
    .trim()
    .split('\n')
    .filter(Boolean);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes("proguard-android-optimize.txt")) continue;
    const patched = content.replace(
      /proguard-android\.txt/g,
      'proguard-android-optimize.txt'
    );
    fs.writeFileSync(file, patched, 'utf-8');
    console.log(`[fix-proguard] patched ${path.relative(nodeModules, file)}`);
  }
} catch {
  // grep returns exit code 1 when no matches — nothing to patch
}
