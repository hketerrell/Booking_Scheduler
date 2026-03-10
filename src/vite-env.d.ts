/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKER_API_URL?: string;
  readonly VITE_WORKER_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
