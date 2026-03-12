const ALLOWED_ORIGINS = new Set([
  'https://hketerrell.github.io',
  'https://simpson2002-hke.github.io',
]);

const getCorsHeaders = (request) => {
  const origin = request.headers.get('Origin');
  const isAllowed = origin && ALLOWED_ORIGINS.has(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
};

const json = (request, data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
      ...(init.headers || {}),
    },
  });

const isAuthorized = (request, env) => {
  if (!env.API_KEY) {
    return true;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  return token === env.API_KEY;
};

const getGitHubConfig = (env) => {
  const owner = (env.GITHUB_OWNER ?? '').trim();
  const repo = (env.GITHUB_REPO ?? '').trim();
  const token = (env.GITHUB_TOKEN ?? '').trim();
  const branch = (env.GITHUB_BRANCH ?? 'main').trim() || 'main';
  const filePath = (env.GITHUB_FILE_PATH ?? 'data/booking-state.json').trim() || 'data/booking-state.json';

  if (!owner || !repo || !token) {
    throw new Error('Missing GitHub config. Required: GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN.');
  }

  return { owner, repo, token, branch, filePath };
};

const toBase64 = (value) => btoa(unescape(encodeURIComponent(value)));

const fromBase64 = (value) => decodeURIComponent(escape(atob(value)));

const githubRequest = async ({ owner, repo, token, filePath, branch, method, body }) => {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}${
    method === 'GET' ? `?ref=${encodeURIComponent(branch)}` : ''
  }`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'booking-scheduler-worker',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
};

const getGitHubState = async (env) => {
  const config = getGitHubConfig(env);
  const response = await githubRequest({ ...config, method: 'GET' });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub read failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  if (!payload.content) {
    throw new Error('GitHub file response is missing content.');
  }

  const parsed = JSON.parse(fromBase64(payload.content.replace(/\n/g, '')));

  if (parsed && typeof parsed === 'object' && parsed.state) {
    return parsed.state;
  }

  return parsed;
};

const putGitHubState = async (env, state) => {
  const config = getGitHubConfig(env);
  const existingResponse = await githubRequest({ ...config, method: 'GET' });

  let currentSha;
  if (existingResponse.status !== 404) {
    if (!existingResponse.ok) {
      const errorText = await existingResponse.text();
      throw new Error(`GitHub lookup failed (${existingResponse.status}): ${errorText}`);
    }

    const existingPayload = await existingResponse.json();
    currentSha = existingPayload.sha;
  }

  const payload = {
    state,
    updatedAt: new Date().toISOString(),
  };

  const writeResponse = await githubRequest({
    ...config,
    method: 'PUT',
    body: {
      message: 'Update booking scheduler state',
      content: toBase64(JSON.stringify(payload, null, 2)),
      branch: config.branch,
      ...(currentSha ? { sha: currentSha } : {}),
    },
  });

  if (!writeResponse.ok) {
    const errorText = await writeResponse.text();
    throw new Error(`GitHub write failed (${writeResponse.status}): ${errorText}`);
  }
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return json(request, {}, { status: 200 });
    }

    if (!isAuthorized(request, env)) {
      return json(request, { error: 'Unauthorized' }, { status: 401 });
    }

    try {
      if (request.method === 'GET') {
        const state = await getGitHubState(env);
        if (!state) {
          return json(request, { state: null }, { status: 404 });
        }

        return json(request, { state });
      }

      if (request.method === 'PUT') {
        const payload = await request.json();
        if (!payload.state) {
          return json(request, { error: 'Missing state payload' }, { status: 400 });
        }

        await putGitHubState(env, payload.state);
        return json(request, { ok: true });
      }

      return json(request, { error: 'Method not allowed' }, { status: 405 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return json(request, { error: message }, { status: 500 });
    }
  },
};
