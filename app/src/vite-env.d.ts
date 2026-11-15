/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del modelo de Vosk (por defecto, /voz/vosk-model-es-0.42.tar.gz). */
  readonly VITE_VOSK_MODELO?: string;
  /** Fuerza el motor de voz: 'local' (Vosk) o 'navegador' (Web Speech). */
  readonly VITE_VOSK_MOTOR?: 'local' | 'navegador' | 'auto';
  /** Voz neuronal de Piper (por defecto es_MX-claude-high). */
  readonly VITE_PIPER_VOZ?: string;
  /** '0' desactiva la voz neuronal. */
  readonly VITE_PIPER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
