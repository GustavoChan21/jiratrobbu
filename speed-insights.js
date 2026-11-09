(() => {
  if (window.__TROBBU_SPEED_INSIGHTS__) return;

  const host = window.location.hostname || '';
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
  const isGitHubPages = host.endsWith('.github.io');

  // Speed Insights funciona en deployments Vercel. Evitamos 404 en local/GitHub Pages.
  if (isLocal || isGitHubPages) return;

  window.__TROBBU_SPEED_INSIGHTS__ = true;
  window.si = window.si || function () {
    (window.siq = window.siq || []).push(arguments);
  };

  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/speed-insights/script.js';
  script.dataset.sdkn = '@vercel/speed-insights';
  document.head.appendChild(script);
})();
