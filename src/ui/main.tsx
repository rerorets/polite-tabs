import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, type Surface } from './App';
import { applySecondaryMonitorFix } from './secondaryMonitorFix';
import './styles.css';

const surface: Surface = document.body.classList.contains('options') ? 'options' : 'popup';
if (surface === 'popup') void applySecondaryMonitorFix();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App surface={surface} />
  </StrictMode>
);
