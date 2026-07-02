import { describe, it, expect } from 'vitest';
import { pickConfig, DEFAULT_CONFIGS } from '../src/content/sites/index.js';
import { mergeConfigs } from '../src/content/selectors.js';

describe('pickConfig', () => {
  it('matches a site by host, including subdomains', () => {
    expect(pickConfig(DEFAULT_CONFIGS, 'www.bbc.co.uk', '/news').id).toBe('bbc');
    expect(pickConfig(DEFAULT_CONFIGS, 'news.google.com', '/').id).toBe('google-news');
  });

  it('requires the path prefix for google search', () => {
    expect(pickConfig(DEFAULT_CONFIGS, 'www.google.com', '/maps')).toBe(null);
    expect(pickConfig(DEFAULT_CONFIGS, 'www.google.com', '/search?q=x').id).toBe('google-search');
  });

  it('covers reddit new and old, the guardian and youtube', () => {
    expect(pickConfig(DEFAULT_CONFIGS, 'www.reddit.com', '/').id).toBe('reddit');
    expect(pickConfig(DEFAULT_CONFIGS, 'old.reddit.com', '/').id).toBe('reddit-old');
    expect(pickConfig(DEFAULT_CONFIGS, 'www.theguardian.com', '/uk').id).toBe('guardian');
    expect(pickConfig(DEFAULT_CONFIGS, 'www.youtube.com', '/').id).toBe('youtube');
  });

  it('returns null for unknown sites unless generic fallback is allowed', () => {
    expect(pickConfig(DEFAULT_CONFIGS, 'example.com', '/')).toBe(null);
    expect(pickConfig(DEFAULT_CONFIGS, 'example.com', '/', { allowGeneric: true }).id).toBe('generic');
  });
});

describe('mergeConfigs', () => {
  it('overlays a higher-versioned remote config over the bundled default', () => {
    const merged = mergeConfigs(DEFAULT_CONFIGS, [{ id: 'bbc', version: 9, container: '.new' }]);
    const bbc = merged.find((c) => c.id === 'bbc');
    expect(bbc.version).toBe(9);
    expect(bbc.container).toBe('.new');
  });

  it('ignores a lower-versioned remote config', () => {
    const merged = mergeConfigs(DEFAULT_CONFIGS, [{ id: 'bbc', version: 0, container: '.old' }]);
    expect(merged.find((c) => c.id === 'bbc').container).not.toBe('.old');
  });
});
