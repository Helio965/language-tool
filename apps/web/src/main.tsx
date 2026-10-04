import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createApiClient } from './services';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado');

createRoot(root).render(
  <StrictMode>
    <App api={createApiClient()} />
  </StrictMode>,
);
