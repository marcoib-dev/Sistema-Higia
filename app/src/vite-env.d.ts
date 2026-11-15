/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del modelo de Vosk (por defecto, /voz/vosk-model-small-es-0.42.tar.gz). */
  readonly VITE_VOSK_MODELO?: string;
  /** Fuerza el motor de voz: 'local' (Vosk) o 'navegador' (Web Speech). */
  readonly VITE_VOSK_MOTOR?: 'local' | 'navegador' | 'auto';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
