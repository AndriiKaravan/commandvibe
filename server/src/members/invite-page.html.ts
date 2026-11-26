export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface InvitePageInput {
  appUrl: string;
  token: string;
  /** Undefined when the link no longer works. */
  group?: { name: string; memberCount: number };
}

/** Light page for link previews in messengers; sends the visitor straight to the app. */
export function invitePageHtml({ appUrl, token, group }: InvitePageInput): string {
  const target = `${appUrl}/join?t=${encodeURIComponent(token)}`;
  const title = group ? `Вас запросили в гру «${escapeHtml(group.name)}»` : 'Посилання більше не діє';
  const description = group
    ? `${group.memberCount} учасників · CommandVibe`
    : 'Попросіть організатора надіслати нове посилання · CommandVibe';
  const redirect = group ? `<script>location.replace(${JSON.stringify(target)});</script>` : '';
  const action = group ? `<a class="button" href="${escapeHtml(target)}">Відкрити</a>` : '';
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="CommandVibe">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(appUrl)}/og/invite.png">
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0d1a;color:#f4f2ff;font:16px/1.4 system-ui,sans-serif}
main{max-width:22rem;padding:2rem;text-align:center}
.button{display:inline-block;margin-top:1rem;padding:.8rem 1.6rem;border-radius:999px;background:#7c5cff;color:#fff;text-decoration:none;font-weight:600}
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p>${escapeHtml(description)}</p>
${action}
</main>
${redirect}
</body>
</html>`;
}
