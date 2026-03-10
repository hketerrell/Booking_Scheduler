export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH?: string;
  GITHUB_FILE_PATH: string;
  API_KEY?: string;
}

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...(init?.headers ?? {}),
    },
  });

const isAuthorized = (request: Request, env: Env) => {
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

const getGithubFile = async (env: Env) => {
  const branch = env.GITHUB_BRANCH ?? 'main';
  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE_PATH}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub read failed: ${response.status}`);
  }

  const data = (await response.json()) as { content: string; sha: string };
  const decoded = atob(data.content.replace(/\n/g, ''));
  return { sha: data.sha, text: decoded };
};

const putGithubFile = async (env: Env, content: string, sha?: string) => {
  const branch = env.GITHUB_BRANCH ?? 'main';
  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${env.GITHUB_FILE_PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Update booking scheduler data (${new Date().toISOString()})`,
        content: btoa(unescape(encodeURIComponent(content))),
        branch,
        sha,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub write failed: ${response.status}`);
  }
};

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return json({}, { status: 200 });
    }

    if (!isAuthorized(request, env)) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      if (request.method === 'GET') {
        const file = await getGithubFile(env);
        if (!file) {
          return json({ state: null }, { status: 404 });
        }

        return json({ state: JSON.parse(file.text) });
      }

      if (request.method === 'PUT') {
        const payload = (await request.json()) as { state?: unknown };
        if (!payload.state) {
          return json({ error: 'Missing state payload' }, { status: 400 });
        }

        const existingFile = await getGithubFile(env);
        await putGithubFile(env, JSON.stringify(payload.state, null, 2), existingFile?.sha);
        return json({ ok: true });
      }

      return json({ error: 'Method not allowed' }, { status: 405 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return json({ error: message }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
