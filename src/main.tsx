import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { testConnection } from './lib/firebase';
import {AuthProvider} from './lib/AuthContext';
import { DataProvider } from './lib/DataContext';
import { TranslationProvider } from './lib/translations';
import { ConfirmProvider } from './lib/ConfirmContext';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

testConnection();
defineCustomElements(window);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <TranslationProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </TranslationProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
