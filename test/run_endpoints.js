const { spawn } = require('child_process');
const http = require('http');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

const TEST_CASES = [
  { path: '/', expectedStatus: 200 },
  { path: '/profile/bsky.app', expectedStatus: 200 },
  { path: '/profile/bsky.app/posts', expectedStatus: 200 },
  { path: '/profile/j4ck.xyz/post/3mmkleuz4xc2f', expectedStatus: 200 },
  { path: '/profile/j4ck.xyz/post/3mmkleuz4xc2f/single', expectedStatus: 200 },
  { path: '/profile/j4ck.xyz/post/3mmkleuz4xc2f/thread', expectedStatus: 200 },
  { path: '/profile/j4ck.xyz/post/3mmkleuz4xc2f/quotes', expectedStatus: 200 },
  { path: '/profile/j4ck.xyz/post/3mmkleuz4xc2f/also-liked', expectedStatus: 200 },
  { path: '/profile/bsky.app/activity', expectedStatus: 200 },
  { path: '/profile/bsky.app/feed/whats-hot', expectedStatus: 200 },
  { path: '/profile/bsky.app/likes', expectedStatus: 403 }, // 403 expected due to privacy
  { path: '/profile/bsky.app/followers', expectedStatus: 200 },
  { path: '/profile/bsky.app/following', expectedStatus: 200 },
  { path: '/profile/bsky.app/lists', expectedStatus: 200 },
  { path: '/profile/bsky.app/list/3lhr7u7k2s22b', expectedStatus: [200, 404] },
  { path: '/profile/bsky.app/starter-pack/3lhreomsy5k2x', expectedStatus: [200, 404] },
  { path: '/search?q=atproto', expectedStatus: 200 },
  { path: '/links?url=theverge.com', expectedStatus: 200 },
  { path: '/trending', expectedStatus: 200 },
  { path: '/llms.txt', expectedStatus: 200 },
  { path: '/cli', expectedStatus: 200 },
  { path: '/docs', expectedStatus: 200 },
];

function waitPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error(`Timeout waiting for Next.js server on port ${port}`));
        return;
      }
      const req = http.request({ host: 'localhost', port, method: 'GET', path: '/' }, (res) => {
        clearInterval(timer);
        resolve();
      });
      req.on('error', () => {
        // Continue retrying
      });
      req.end();
    }, 800);
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('    BSKY.MD - INTEGRATION TEST RUNNER');
  console.log('====================================================');
  console.log(`Starting local Next.js server on port ${PORT}...`);
  
  // Start server using npm run dev in a detached process group with high rate limits
  const child = spawn('npm', ['run', 'dev', '--', '-p', PORT.toString()], {
    stdio: 'inherit',
    shell: true,
    detached: true,
    env: { ...process.env, RATE_LIMIT_MAX: '150' },
  });

  // Ensure process group is killed on exit
  const cleanup = () => {
    console.log('\nShutting down local Next.js server...');
    try {
      process.kill(-child.pid, 'SIGINT');
    } catch (e) {
      // ignore
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { process.exit(); });

  try {
    await waitPort(PORT);
    console.log('\nNext.js server is up and responsive! Running tests...\n');

    let passed = 0;
    let failed = 0;

    for (const tc of TEST_CASES) {
      const url = `${BASE_URL}${tc.path}`;
      const start = Date.now();
      
      process.stdout.write(`GET ${tc.path.padEnd(50, ' ')}`);

      try {
        const res = await fetch(url);
        const duration = Date.now() - start;
        const text = await res.text();

        const expected = Array.isArray(tc.expectedStatus) ? tc.expectedStatus : [tc.expectedStatus];
        if (expected.includes(res.status)) {
          passed++;
          console.log(`[\x1b[32m  OK  \x1b[0m] Status: ${res.status} (${duration}ms)`);
        } else {
          failed++;
          console.log(`[\x1b[31m FAIL \x1b[0m] Status: ${res.status} (Expected: ${expected.join(' or ')}) (${duration}ms)`);
          console.log(`         Error body: ${text.slice(0, 120).trim()}`);
        }
      } catch (err) {
        failed++;
        const duration = Date.now() - start;
        console.log(`[\x1b[31m FAIL \x1b[0m] Error: ${err.message} (${duration}ms)`);
      }
    }

    console.log('\n====================================================');
    console.log(`TEST SUMMARY:`);
    console.log(`  Total:  ${TEST_CASES.length}`);
    console.log(`  \x1b[32mPassed: ${passed}\x1b[0m`);
    console.log(`  \x1b[31mFailed: ${failed}\x1b[0m`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('\nFatal test failure:', err.message);
    process.exit(1);
  }
}

runTests();
