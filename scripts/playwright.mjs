import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(projectRoot, 'node_modules', '@playwright', 'test', 'cli.js');
const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(projectRoot, '.playwright-browsers');
const args = process.argv.slice(2);
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserPath };
const runCli = (cliArgs) => new Promise((resolve) => {
  const child = spawn(process.execPath, [cliPath, ...cliArgs], { cwd: projectRoot, env, stdio: 'inherit' });
  child.once('error', () => resolve(1));
  child.once('exit', (code) => resolve(code ?? 1));
});

if (args[0] !== 'test') {
  const result = spawnSync(process.execPath, [cliPath, ...args], { cwd: projectRoot, env, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} else {
  const url = 'http://127.0.0.1:4173/';
  let server = null;
  let status = 1;
  try {
    try {
      await fetch(url);
    } catch {
      server = spawn(process.execPath, [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { cwd: projectRoot, env, stdio: 'inherit' });
      let ready = false;
      for (let attempt = 0; attempt < 300; attempt += 1) {
        if (server.exitCode !== null) throw new Error('Vite exited before the browser test server became ready.');
        try {
          const response = await fetch(url);
          ready = response.ok;
          if (ready) break;
        } catch {
          await delay(100);
        }
      }
      if (!ready) throw new Error('Timed out waiting for the Vite browser test server.');
    }
    status = await runCli(args);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => server.once('exit', resolve));
    }
  }
  process.exitCode = status;
}
