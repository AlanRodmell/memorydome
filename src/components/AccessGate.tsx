import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { sha256Hex, ACCESS_KEY, ALLOWED_EMAIL_HASHES } from '../services/memoryDomeService';
import { playChime } from '../services/soundEffects';

interface AccessGateProps {
  isOpen: boolean;
  onUnlocked: () => void;
}

export const AccessGate: React.FC<AccessGateProps> = ({ isOpen, onUnlocked }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleVerify = async (emailToVerify: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const hash = await sha256Hex(emailToVerify);
      if (ALLOWED_EMAIL_HASHES.includes(hash)) {
        try {
          localStorage.setItem(ACCESS_KEY, hash);
        } catch {
          // ignore localStorage restrictions
        }
        playChime(660);
        onUnlocked();
      } else {
        setError("That email doesn't have access.");
      }
    } catch {
      setError('Unable to verify credentials. Please check your browser crypto support.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    handleVerify(email);
  };

  const handleQuickUnlockAlan = () => {
    setEmail('alan.rodmell@gmail.com');
    handleVerify('alan.rodmell@gmail.com');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cerebro Access Gate"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-fadeIn select-none"
    >
      <div className="glass-panel rounded-3xl p-7 w-full max-w-sm text-center border border-amber-400/40 shadow-2xl relative overflow-hidden">
        {/* Decorative ambient glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4">
          <KeyRound className="w-6 h-6 text-slate-950" />
        </div>

        <h2 className="serif-font text-2xl text-amber-100 font-semibold mb-1">
          Cerebro Memory Tapestry
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Enter your authorized email to access the memory chamber.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alan.rodmell@gmail.com"
            required
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-slate-100 text-center placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm transition shadow-lg shadow-amber-400/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {isSubmitting ? 'Verifying...' : 'Enter Dome'}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-xs text-rose-300 bg-rose-950/40 py-1.5 px-3 rounded-lg border border-rose-800/50">
            {error}
          </p>
        )}

        {/* Quick unlock helper for Alan Rodmell */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleQuickUnlockAlan}
            className="text-[11px] text-amber-300/80 hover:text-amber-200 transition underline underline-offset-4 flex items-center justify-center gap-1 mx-auto"
          >
            <Sparkles className="w-3 h-3" />
            <span>Continue as Alan Rodmell</span>
          </button>
        </div>
      </div>
    </div>
  );
};
