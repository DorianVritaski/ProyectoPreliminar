import React, { useState } from 'react';
import { X, Lock, Shield, ArrowRight, Loader2, AlertCircle, KeyRound, Sparkles } from 'lucide-react';
import { api } from '../../api/client';

export default function AdminLoginModal({ isOpen, onClose, onSuccessLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleFillDemo = () => {
    setUsername('operaciones@continental.edu.pe');
    setPassword('admin2026');
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await api.adminLogin(username, password);
      onSuccessLogin(res);
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/30 border border-brand-500/40 flex items-center justify-center">
              <Shield className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-brand-300">
                Acceso Privado
              </span>
              <h2 className="text-lg font-bold">Jefatura de Operaciones</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Módulo restringido para la coordinación y aprobación de requerimientos hacia las áreas de Mantenimiento, TI, SSOMA y Vigilancia.
          </p>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Usuario / Correo Institucional
            </label>
            <input
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="operaciones@continental.edu.pe"
              required
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Contraseña de Administración
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
          </div>

          {/* Botón rápido Demo */}
          <button
            type="button"
            onClick={handleFillDemo}
            className="w-full py-2 px-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 hover:bg-brand-50 text-xs text-brand-700 font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cargar credenciales de demostración</span>
          </button>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white font-bold text-sm py-3 rounded-xl shadow-md shadow-brand-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Ingresar al Dashboard</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
