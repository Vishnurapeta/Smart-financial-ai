/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_ML_SERVICE_URL: string;
  readonly VITE_SOCKET_URL: string;
  readonly VITE_DEFAULT_LOCALE: string;
  readonly VITE_DEFAULT_CURRENCY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
