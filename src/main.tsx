import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {error};
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-4 shadow-xl">
            <h1 className="text-base font-bold text-amber-400">
              Erreur d’affichage détectée
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Une erreur inattendue est survenue lors du chargement de l’atelier.
              Vous pouvez recharger la page ou réinitialiser les préférences locales.
            </p>
            <pre className="text-[11px] font-mono bg-slate-950 border border-slate-800 rounded p-3 text-rose-300 overflow-x-auto">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2 px-3 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
              >
                Recharger
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('atelier_ref_pricing_v1');
                    localStorage.removeItem('atelier_theme');
                  } catch {
                    // ignore
                  }
                  window.location.reload();
                }}
                className="py-2 px-3 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
              >
                Réinit. préférences
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
