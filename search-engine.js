'use strict';
(() => {
  const DEFAULT = Object.freeze({engine: 'google', customTemplate: ''});
  const ENGINES = new Set(['google', 'bing', 'custom']);
  const QUERY_TOKEN = '{query}';
  const CUSTOM_EXAMPLE = 'https://search.example.com/?q={query}';

  function validCustomTemplate(value) {
    if (typeof value !== 'string' || !value || value.length > 2048 ||
      value.split(QUERY_TOKEN).length !== 2) return false;
    try {
      const marker = 'meridian-search-query';
      const url = new URL(value.replace(QUERY_TOKEN, marker));
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password &&
        !url.hash.includes(marker) && (url.pathname.includes(marker) || url.search.includes(marker));
    } catch {
      return false;
    }
  }

  function normalize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !ENGINES.has(value.engine)) {
      return {...DEFAULT};
    }
    const customTemplate = typeof value.customTemplate === 'string' && value.customTemplate.length <= 2048 ?
      value.customTemplate : '';
    if (value.engine === 'custom' && !validCustomTemplate(customTemplate)) return {...DEFAULT};
    return {engine: value.engine, customTemplate};
  }

  function searchUrl(preference, query) {
    const selected = normalize(preference);
    if (selected.engine === 'custom') {
      return new URL(selected.customTemplate.replace(QUERY_TOKEN, encodeURIComponent(query))).href;
    }
    const url = new URL(selected.engine === 'bing' ?
      'https://www.bing.com/search' :
      'https://www.google.com/search');
    url.searchParams.set('q', query);
    return url.href;
  }

  const api = {DEFAULT, CUSTOM_EXAMPLE, normalize, validCustomTemplate, searchUrl};
  globalThis.MeridianSearchEngine = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
