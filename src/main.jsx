import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

// Initialize Sentry Error Monitoring if VITE_SENTRY_DSN is configured
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: 'local',
    // Disable session replays as required
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Sanitize error events and breadcrumbs to protect sensitive PII and auth data
    beforeSend(event) {
      if (!event) return null;

      // 1. Scrub user object if attached
      if (event.user) {
        delete event.user.ip_address;
        delete event.user.email;
        delete event.user.username;
        delete event.user.phone;
      }

      // 2. Scrub sensitive request headers / query strings if present
      if (event.request?.headers) {
        ['authorization', 'cookie', 'token', 'x-auth-token', 'set-cookie'].forEach(h => {
          if (event.request.headers[h]) event.request.headers[h] = '[REDACTED]';
        });
      }

      // 3. Scrub sensitive keys from extra contexts and breadcrumbs
      const sensitiveKeyRegex = /(password|token|secret|authorization|bearer|credit|pan|aadhar|phone|mobile|apiKey|credentials)/i;
      if (event.breadcrumbs && Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs.forEach(breadcrumb => {
          if (breadcrumb.data && typeof breadcrumb.data === 'object') {
            Object.keys(breadcrumb.data).forEach(k => {
              if (sensitiveKeyRegex.test(k)) {
                breadcrumb.data[k] = '[REDACTED]';
              }
            });
          }
        });
      }

      if (event.extra && typeof event.extra === 'object') {
        Object.keys(event.extra).forEach(k => {
          if (sensitiveKeyRegex.test(k)) {
            event.extra[k] = '[REDACTED]';
          }
        });
      }

      return event;
    }
  });
}

// Prevent mouse scroll wheel from inadvertently changing values in focused number inputs
document.addEventListener('wheel', (e) => {
  if (document.activeElement && document.activeElement.type === 'number') {
    document.activeElement.blur();
  }
}, { passive: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {sentryDsn ? (
      <Sentry.ErrorBoundary fallback={({ error, resetError }) => (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          color: '#0F172A',
          fontFamily: "'DM Sans', -apple-system, sans-serif",
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.05)'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>Application Render Recovery</h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px', lineHeight: '1.5' }}>
              An unexpected interface error occurred. The incident has been recorded for diagnostics.
            </p>
            <button
              onClick={() => {
                resetError();
                window.location.reload();
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      )}>
        <App />
      </Sentry.ErrorBoundary>
    ) : (
      <App />
    )}
  </StrictMode>,
)
