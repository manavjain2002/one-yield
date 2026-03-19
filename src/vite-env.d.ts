/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_HEDERA_NETWORK?: string;
  readonly VITE_MIRROR_NODE_URL?: string;
  readonly VITE_FACTORY_CONTRACT_ID?: string;
  readonly VITE_USE_MOCK_WALLET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
