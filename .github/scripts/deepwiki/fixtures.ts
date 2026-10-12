import type { Page } from 'playwright'

export const mainSha = 'b'.repeat(40)
export const indexedSha = 'a'.repeat(40)
export const email = 'test@example.test'
export const now = Date.parse('2026-10-12T00:00:00Z')
export const wikiUrl = 'https://deepwiki.com/weapp-vite/weapp-vite'
export const acceptedText = 'Refresh started! We\'ll email you when the refresh completes.'

interface FixtureOptions {
  date?: string
  sha?: string
  index?: string
  body?: string
  refresh?: string
  openOutcome?: 'login'
  outcome?: 'accepted' | 'cooldown' | 'login' | 'captcha' | 'unknown' | 'console-error' | 'post-error' | 'post-error-console'
  delay?: number
  enabledDelay?: number
}

export function fixture(options: FixtureOptions = {}) {
  const sha = options.sha ?? indexedSha
  const date = options.date ?? '4 October 2026'
  const index = options.index ?? `<p>Last indexed: ${date} (<a href="https://github.com/weapp-vite/weapp-vite/commits/${sha}">${sha.slice(0, 7)}</a>)</p>`
  const refresh = options.refresh ?? '<button id="open">Enter email to refresh</button>'
  const outcomes = {
    'accepted': `<p role="status">${acceptedText}</p>`,
    'cooldown': '<p>Wait 3 days to refresh</p>',
    'login': '<p>Sign in to refresh this wiki</p>',
    'captcha': '<iframe title="reCAPTCHA" src="https://www.google.com/recaptcha/api2/bframe"></iframe>',
    'unknown': '<p>Thanks for visiting</p>',
    'console-error': '<p>Thanks for visiting</p>',
    'post-error': '<p>Thanks for visiting</p>',
    'post-error-console': '<p>Thanks for visiting</p>',
  }
  return `<!doctype html><html><head><title>weapp-vite | DeepWiki</title></head><body>
    <main>${options.body ?? ''}${index}</main>
    <section id="refresh"><p>Refresh this wiki</p>${refresh}</section>
    <script>
      window.events = { opens: 0, inputs: 0, submits: 0 };
      document.querySelector('#open')?.addEventListener('click', () => {
        window.events.opens++;
        if (${JSON.stringify(options.openOutcome)} === 'login') {
          document.querySelector('#refresh').innerHTML = '<p>Refresh this wiki</p><p>Sign in to refresh this wiki</p>';
          return;
        }
        document.querySelector('#refresh').innerHTML = '<p>Refresh this wiki</p><form><input type="email" placeholder="Enter your email" required><button disabled>Start refresh</button></form>';
        const form = document.querySelector('form');
        const input = form.querySelector('input');
        const submit = form.querySelector('button');
        input.addEventListener('input', () => {
          window.events.inputs++;
          setTimeout(() => { submit.disabled = !input.checkValidity(); }, ${options.enabledDelay ?? 0});
        });
        form.addEventListener('submit', event => {
          event.preventDefault();
          window.events.submits++;
          submit.disabled = true;
          if (${JSON.stringify(options.outcome)} === 'console-error') console.error('Failed to refresh wiki: unavailable');
          if (['post-error', 'post-error-console'].includes(${JSON.stringify(options.outcome)})) {
            fetch('https://api.devin.ai/ada/index_public_repo', { method: 'POST' }).then(() => {
              if (${JSON.stringify(options.outcome)} === 'post-error-console') console.error('Failed to refresh wiki: unavailable');
            });
          }
          setTimeout(() => { document.querySelector('#refresh').innerHTML = ${JSON.stringify(outcomes[options.outcome ?? 'accepted'])}; }, ${options.delay ?? 0});
        });
      });
    </script>
  </body></html>`
}

export async function serve(page: Page, html: string, status = 200, refreshStatus?: number) {
  await page.route('**/*', async (route) => {
    if (route.request().url() === wikiUrl) {
      await route.fulfill({ status, contentType: 'text/html', body: html })
    }
    else if (refreshStatus && route.request().url() === 'https://api.devin.ai/ada/index_public_repo') {
      await route.fulfill({ status: refreshStatus, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: '{"error":"unavailable"}' })
    }
    else {
      await route.abort()
    }
  })
}

export async function events(page: Page) {
  return page.evaluate(() => (window as unknown as {
    events: { opens: number, inputs: number, submits: number }
  }).events)
}
