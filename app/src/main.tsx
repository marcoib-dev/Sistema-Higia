import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { IdiomaProvider } from './ui/idioma';
import './ui/estilos.css';
import './ui/presencia.css';
import './ui/secciones.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IdiomaProvider>
      <App />
    </IdiomaProvider>
  </StrictMode>,
);
