export const DEFAULT_MADGRADES_BASE_URL = 'https://api.madgrades.com/v1';

function normalizeMadgradesToken(token) {
  const normalized = String(token ?? '').trim();
  if (!normalized) {
    throw new Error('Madgrades API token is required');
  }

  return normalized;
}

function buildMadgradesUrl(baseUrl, path) {
  if (/^https?:\/\//.test(String(path ?? ''))) {
    return String(path);
  }

  const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, '');
  const normalizedPath = String(path ?? '').replace(/^\/+/, '');
  return `${normalizedBaseUrl}/${normalizedPath}`;
}

function withPaging(url, { page, perPage }) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}per_page=${encodeURIComponent(String(perPage))}&page=${encodeURIComponent(String(page))}`;
}

function requireMadgradesResultsArray(payload, url) {
  if (!Array.isArray(payload?.results)) {
    throw new Error(`Madgrades API returned invalid payload for ${url}: results must be an array`);
  }

  return payload.results;
}

function getMadgradesPaginationMetadata(payload, url, fallbackPage) {
  const currentPage = Number(payload?.currentPage ?? fallbackPage);
  if (!Number.isFinite(currentPage)) {
    throw new Error(
      `Madgrades API returned invalid pagination metadata for ${url}: currentPage must be a finite number`,
    );
  }

  const totalPages = Number(payload?.totalPages);
  if (payload?.totalPages != null && !Number.isFinite(totalPages)) {
    throw new Error(
      `Madgrades API returned invalid pagination metadata for ${url}: totalPages must be a finite number`,
    );
  }

  return { currentPage, totalPages };
}

export function buildMadgradesHeaders(token) {
  const normalizedToken = normalizeMadgradesToken(token);

  return {
    Authorization: `Token token=${normalizedToken}`,
    Accept: 'application/json',
  };
}

export async function fetchMadgradesJson({
  token,
  path,
  baseUrl = DEFAULT_MADGRADES_BASE_URL,
  fetchImpl = fetch,
}) {
  const url = buildMadgradesUrl(baseUrl, path);
  const response = await fetchImpl(url, {
    headers: buildMadgradesHeaders(token),
  });
  const responseText = await response.text();

  if (!response.ok) {
    let parsedError = null;

    try {
      parsedError = JSON.parse(responseText);
    } catch {
      parsedError = null;
    }

    const detail = typeof parsedError?.error === 'string'
      ? `: ${parsedError.error}`
      : typeof parsedError?.message === 'string'
        ? `: ${parsedError.message}`
        : '';
    throw new Error(
      `Madgrades API request failed (${response.status} ${response.statusText}) for ${url}${detail}`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Madgrades API returned invalid JSON for ${url}: ${error.message}`);
  }

  return parsed;
}

export async function fetchMadgradesPagedResults({
  token,
  path,
  baseUrl = DEFAULT_MADGRADES_BASE_URL,
  fetchImpl = fetch,
  perPage = 200,
}) {
  const results = [];
  let page = 1;
  let nextPath = withPaging(buildMadgradesUrl(baseUrl, path), { page, perPage });

  while (true) {
    const currentRequestUrl = nextPath;
    const payload = await fetchMadgradesJson({
      token,
      path: currentRequestUrl,
      baseUrl,
      fetchImpl,
    });

    if (Array.isArray(payload)) {
      results.push(...payload);

      if (payload.length === 0) {
        return results;
      }

      page += 1;
      nextPath = withPaging(buildMadgradesUrl(baseUrl, path), { page, perPage });
      continue;
    }

    const pageResults = requireMadgradesResultsArray(payload, currentRequestUrl);
    results.push(...pageResults);

    const { totalPages, currentPage } = getMadgradesPaginationMetadata(payload, currentRequestUrl, page);

    if (typeof payload?.nextPageUrl === 'string' && payload.nextPageUrl.trim()) {
      nextPath = payload.nextPageUrl;
      page = currentPage + 1;
      continue;
    }

    if (!Number.isFinite(totalPages) || currentPage >= totalPages) {
      return results;
    }

    page = currentPage + 1;
    nextPath = withPaging(buildMadgradesUrl(baseUrl, path), { page, perPage });
  }
}
