// Bundled default selector configs. background.js can overlay newer versions
// fetched from /api/selectors so selector breakage is fixed without shipping a
// new extension build.

import googleNews from './google-news.json';
import bbc from './bbc.json';
import googleSearch from './google-search.json';
import reddit from './reddit.json';
import redditOld from './reddit-old.json';
import guardian from './guardian.json';
import youtube from './youtube.json';
import generic from './generic.json';

export const DEFAULT_CONFIGS = [
  googleNews, bbc, googleSearch, reddit, redditOld, guardian, youtube, generic
];

function hostMatches(config, host) {
  return (config.match || []).some((m) => host === m || host.endsWith('.' + m));
}

/**
 * Choose the best selector config for a location. Site-specific configs win
 * over the generic fallback; a config with `pathPrefix` must also match the
 * path. Returns null when nothing applies (generic is only returned when
 * `allowGeneric` is set).
 */
export function pickConfig(configs, host, path = '/', { allowGeneric = false } = {}) {
  const clean = String(host || '').replace(/^www\./, '');
  const candidates = configs.filter((c) => c.id !== 'generic');
  for (const c of candidates) {
    const matchHost = hostMatches(c, host) || hostMatches(c, clean);
    const matchPath = !c.pathPrefix || path.startsWith(c.pathPrefix);
    if (matchHost && matchPath) return c;
  }
  if (allowGeneric) return configs.find((c) => c.id === 'generic') || null;
  return null;
}
