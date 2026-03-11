export interface Env {
  MONGODB_DATA_API_URL: string;
  MONGODB_DATA_API_KEY: string;
  MONGODB_DATA_SOURCE: string;
  MONGODB_DATABASE: string;
  MONGODB_COLLECTION: string;
  MONGODB_DOCUMENT_ID?: string;
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

interface MongoDataApiResponse<T> {
  document?: T;
  modifiedCount?: number;
  upsertedId?: unknown;
  matchedCount?: number;
}

const getDocumentId = (env: Env) => env.MONGODB_DOCUMENT_ID ?? 'booking-scheduler-state';

const mongoRequest = async <T>(env: Env, action: string, body: Record<string, unknown>): Promise<T> => {
  const response = await fetch(`${env.MONGODB_DATA_API_URL.replace(/\/$/, '')}/action/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.MONGODB_DATA_API_KEY,
    },
    body: JSON.stringify({
      dataSource: env.MONGODB_DATA_SOURCE,
      database: env.MONGODB_DATABASE,
      collection: env.MONGODB_COLLECTION,
      ...body,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MongoDB Data API ${action} failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
};

const getMongoState = async (env: Env) => {
  const result = await mongoRequest<MongoDataApiResponse<{ state?: unknown }>>(env, 'findOne', {
    filter: { _id: getDocumentId(env) },
    projection: { state: 1, _id: 0 },
  });

  return result.document?.state ?? null;
};

const putMongoState = async (env: Env, state: unknown) => {
  await mongoRequest<MongoDataApiResponse<unknown>>(env, 'updateOne', {
    filter: { _id: getDocumentId(env) },
    update: {
      $set: {
        state,
        updatedAt: new Date().toISOString(),
      },
    },
    upsert: true,
  });
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
        const state = await getMongoState(env);
        if (!state) {
          return json({ state: null }, { status: 404 });
        }

        return json({ state });
      }

      if (request.method === 'PUT') {
        const payload = (await request.json()) as { state?: unknown };
        if (!payload.state) {
          return json({ error: 'Missing state payload' }, { status: 400 });
        }

        await putMongoState(env, payload.state);
        return json({ ok: true });
      }

      return json({ error: 'Method not allowed' }, { status: 405 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return json({ error: message }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

