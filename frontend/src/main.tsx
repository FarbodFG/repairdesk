import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/api/queries'
import { AuthProvider } from './features/auth/AuthProvider'
import { ToastProvider } from './components/ui/Toast'
import { ErrorBoundary } from './app/ErrorBoundary'
import { App } from './app/App'
import './styles/tokens.css'
import './styles/public.css'
import './styles/app.css'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
