import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './app/queryClient';
import { AuthProvider } from './context/AuthContext';
import './index.css';
import { AppRouter } from './routes/AppRouter';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
        <Toaster
          position="top-center"
          toastOptions={{ style: { borderRadius: '9999px', background: '#1d1d1f', color: '#fff', fontSize: '14px' } }}
        />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
