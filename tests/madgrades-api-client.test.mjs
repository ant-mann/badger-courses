import test from 'node:test';
import assert from 'node:assert/strict';

const loadApiClient = () => import('../src/madgrades/api-client.mjs');

function createJsonResponse({
  ok = true,
  status = 200,
  statusText = 'OK',
  body,
  url = 'https://api.madgrades.com/v1/test',
}) {
  return {
    ok,
    status,
    statusText,
    url,
    async text() {
      return JSON.stringify(body);
    },
  };
}

function createTextResponse({
  ok = true,
  status = 200,
  statusText = 'OK',
  body,
  url = 'https://api.madgrades.com/v1/test',
}) {
  return {
    ok,
    status,
    statusText,
    url,
    async text() {
      return body;
    },
  };
}

test('buildMadgradesHeaders formats the authorization header', async () => {
  const { buildMadgradesHeaders } = await loadApiClient();

  assert.deepEqual(buildMadgradesHeaders('  secret-token  '), {
    Authorization: 'Token token=secret-token',
    Accept: 'application/json',
  });
});

test('buildMadgradesHeaders rejects a blank token', async () => {
  const { buildMadgradesHeaders } = await loadApiClient();

  assert.throws(() => buildMadgradesHeaders('   '), /Madgrades API token is required/);
});

test('fetchMadgradesJson returns parsed JSON for a successful response', async () => {
  const { fetchMadgradesJson } = await loadApiClient();
  const calls = [];
  const payload = { results: [{ courseId: '12345' }] };

  const result = await fetchMadgradesJson({
    token: 'secret-token',
    path: '/courses',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return createJsonResponse({ body: payload, url });
    },
  });

  assert.deepEqual(result, payload);
  assert.deepEqual(calls, [
    {
      url: 'https://api.madgrades.com/v1/courses',
      options: {
        headers: {
          Authorization: 'Token token=secret-token',
          Accept: 'application/json',
        },
      },
    },
  ]);
});

test('fetchMadgradesJson throws a clear invalid-JSON error for a successful response', async () => {
  const { fetchMadgradesJson } = await loadApiClient();

  await assert.rejects(
    fetchMadgradesJson({
      token: 'secret-token',
      path: '/courses',
      fetchImpl: async () => createTextResponse({ body: 'not json' }),
    }),
    /Madgrades API returned invalid JSON for https:\/\/api\.madgrades\.com\/v1\/courses:/,
  );
});

test('fetchMadgradesJson throws a clear HTTP failure error for a non-OK response with invalid JSON', async () => {
  const { fetchMadgradesJson } = await loadApiClient();

  await assert.rejects(
    fetchMadgradesJson({
      token: 'secret-token',
      path: '/courses',
      fetchImpl: async () => createTextResponse({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        body: '<html>upstream failure</html>',
      }),
    }),
    /Madgrades API request failed \(502 Bad Gateway\) for https:\/\/api\.madgrades\.com\/v1\/courses/,
  );
});

test('fetchMadgradesPagedResults follows paginated object responses', async () => {
  const { fetchMadgradesPagedResults } = await loadApiClient();
  const calls = [];
  const responses = [
    createJsonResponse({
      body: {
        results: [{ id: 1 }, { id: 2 }],
        currentPage: 1,
        totalPages: 2,
        nextPageUrl: 'https://api.madgrades.com/v1/courses?subject=COMP%20SCI&per_page=200&page=2',
      },
    }),
    createJsonResponse({
      body: {
        results: [{ id: 3 }],
        currentPage: 2,
        totalPages: 2,
        nextPageUrl: null,
      },
    }),
  ];

  const result = await fetchMadgradesPagedResults({
    token: 'secret-token',
    path: '/courses?subject=COMP%20SCI',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return responses.shift();
    },
  });

  assert.deepEqual(result, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.deepEqual(calls.map((call) => call.url), [
    'https://api.madgrades.com/v1/courses?subject=COMP%20SCI&per_page=200&page=1',
    'https://api.madgrades.com/v1/courses?subject=COMP%20SCI&per_page=200&page=2',
  ]);
});

test('fetchMadgradesPagedResults rejects malformed object pagination metadata', async () => {
  const { fetchMadgradesPagedResults } = await loadApiClient();

  await assert.rejects(
    fetchMadgradesPagedResults({
      token: 'secret-token',
      path: '/courses?subject=COMP%20SCI',
      fetchImpl: async () => createJsonResponse({
        body: {
          results: [{ id: 1 }],
          currentPage: 'nope',
          totalPages: 2,
          nextPageUrl: 'https://api.madgrades.com/v1/courses?subject=COMP%20SCI&per_page=200&page=2',
        },
      }),
    }),
    /Madgrades API returned invalid pagination metadata for https:\/\/api\.madgrades\.com\/v1\/courses\?subject=COMP%20SCI&per_page=200&page=1: currentPage must be a finite number/,
  );
});

test('fetchMadgradesPagedResults rejects object payloads without a results array', async () => {
  const { fetchMadgradesPagedResults } = await loadApiClient();

  await assert.rejects(
    fetchMadgradesPagedResults({
      token: 'secret-token',
      path: '/courses?subject=COMP%20SCI',
      fetchImpl: async () => createJsonResponse({
        body: {
          currentPage: 1,
          totalPages: 1,
          nextPageUrl: null,
        },
      }),
    }),
    /Madgrades API returned invalid payload for https:\/\/api\.madgrades\.com\/v1\/courses\?subject=COMP%20SCI&per_page=200&page=1: results must be an array/,
  );
});

test('fetchMadgradesPagedResults accepts array responses for explore endpoints', async () => {
  const { fetchMadgradesPagedResults } = await loadApiClient();
  const calls = [];
  const responses = [
    createJsonResponse({
      body: [{ id: 'a' }, { id: 'b' }],
      url: 'https://api.madgrades.com/v1/explore/instructors?subject=COMP%20SCI&per_page=200&page=1',
    }),
    createJsonResponse({
      body: [{ id: 'c' }],
      url: 'https://api.madgrades.com/v1/explore/instructors?subject=COMP%20SCI&per_page=200&page=2',
    }),
    createJsonResponse({
      body: [],
      url: 'https://api.madgrades.com/v1/explore/instructors?subject=COMP%20SCI&per_page=200&page=3',
    }),
  ];

  const result = await fetchMadgradesPagedResults({
    token: 'secret-token',
    path: '/explore/instructors?subject=COMP%20SCI',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return responses.shift();
    },
  });

  assert.deepEqual(result, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  assert.deepEqual(calls.map((call) => call.url), [
    'https://api.madgrades.com/v1/explore/instructors?subject=COMP%20SCI&per_page=200&page=1',
    'https://api.madgrades.com/v1/explore/instructors?subject=COMP%20SCI&per_page=200&page=2',
    'https://api.madgrades.com/v1/explore/instructors?subject=COMP%20SCI&per_page=200&page=3',
  ]);
});
