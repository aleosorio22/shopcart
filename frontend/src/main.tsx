import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <p className="contenedor py-20 text-center text-tinta-suave">ShopCart</p>
  </StrictMode>,
);
