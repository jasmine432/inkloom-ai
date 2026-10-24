import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ChevronDown,
  Key,
  Check,
  Save,
  Compass,
} from 'lucide-react';
import { checkBackendHealth } from '../../services/api';
import { TopographicCurves } from '../TopographicCurves';
import type { BackendHealth } from '../../services/api';

export const SettingsView: React.FC = () => {
  const [defaultContentType, setDefaultContentType] = useState('General content');
  const [sensitivity, setSensitivity] = useState<'conservative' | 'balanced' | 'creative'>('balanced');
  const [minConfidence, setMinConfidence] = useState(80);
  const [requireLegalSignOff, setRequireLegalSignOff] = useState(true);
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [showProviderModal, setShowProviderModal] = useState(false);

  useEffect(() => {
    checkBackendHealth().then((h) => {
      if (h) setHealth(h);
    });
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="relative min-h-full pb-16">
      {/* Topographic line-art in top-right */}
      <TopographicCurves />

      <div className="max-w-3xl mx-auto px-6 sm:px-8 py-6 sm:py-8 space-y-8 relative z-10">
        {/* Header matching reference Screen 6 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-stone-200 text-stone-600 text-xs font-medium shadow-2xs">
              <span>Configuration</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight font-sans">
              Settings
            </h1>

            <p className="text-sm text-stone-600">
              Configure your preferences.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white font-semibold text-xs shadow-xs transition-colors self-start sm:self-auto shrink-0"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Saved preferences</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save settings</span>
              </>
            )}
          </button>
        </div>

        {/* Section 1: AI Provider matching reference Screen 6 */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 font-mono">
            AI Provider
          </h2>

          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-900 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-900">
                    {health?.llmProvider ? health.llmProvider.toUpperCase() === 'GEMINI' ? 'Google Gemini' : health.llmProvider : 'Google Gemini'}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      health?.isLlmConfigured
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        health?.isLlmConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    {health?.isLlmConfigured ? 'Configured' : 'Demo mode'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 font-mono">
                  Model: gemini-3.5-flash-lite
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowProviderModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 transition-colors shadow-2xs self-start sm:self-auto"
            >
              Change
            </button>
          </div>
        </div>

        {/* Section 2: Application Defaults matching reference Screen 6 */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 font-mono">
            Application
          </h2>

          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs space-y-2">
            <label className="block text-xs font-semibold text-stone-800">
              Default content type
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                <Compass className="w-4 h-4" />
              </div>
              <select
                value={defaultContentType}
                onChange={(e) => setDefaultContentType(e.target.value)}
                className="w-full appearance-none bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-10 py-3 text-sm text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all cursor-pointer"
              >
                <option value="General content">General content</option>
                <option value="Product launch announcement">Product launch announcement</option>
                <option value="Press release">Press release</option>
                <option value="Social media post">Social media post</option>
                <option value="Email campaign">Email campaign</option>
                <option value="Blog article">Blog article</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-stone-500">
              Used as the default when creating a new review.
            </p>
          </div>
        </div>

        {/* Section 3: Review Strictness & Governance */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 font-mono">
            Verification Strictness
          </h2>

          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'conservative',
                  title: 'Strict (Regulated)',
                  desc: 'Flags any slight nuance or forward-looking guarantee.',
                },
                {
                  id: 'balanced',
                  title: 'Balanced (Default)',
                  desc: 'Enforces hard factual constraints while allowing standard copy tone.',
                },
                {
                  id: 'creative',
                  title: 'Permissive',
                  desc: 'Flags only direct contradictions and legal covenants.',
                },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSensitivity(m.id as any)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    sensitivity === m.id
                      ? 'border-stone-900 ring-2 ring-stone-900/10 bg-stone-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-900">{m.title}</span>
                    {sensitivity === m.id && <span className="w-2 h-2 rounded-full bg-stone-900" />}
                  </div>
                  <p className="text-[11px] text-stone-500 leading-snug m-0">{m.desc}</p>
                </button>
              ))}
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-stone-700">Minimum Citation Confidence Match</span>
                <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                  {minConfidence}% Match
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="95"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-full accent-stone-900 cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-stone-100 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireLegalSignOff}
                  onChange={(e) => setRequireLegalSignOff(e.target.checked)}
                  className="mt-0.5 accent-stone-900 w-4 h-4 rounded"
                />
                <div className="text-xs">
                  <span className="font-semibold text-stone-800 block">
                    Require explicit reviewer sign-off for contradicted claims
                  </span>
                  <span className="text-stone-500 text-[11px]">
                    Highlights contradicted statements with high severity requiring manual acceptance or dismissal.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Section 4: Security & Environment Protection */}
        <div className="bg-stone-100/70 rounded-2xl border border-stone-200/80 p-5 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
            <Key className="w-3.5 h-3.5 text-stone-600" />
            <span>Server-side API Security</span>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed m-0">
            API keys (including <code className="font-mono text-stone-800 font-semibold">GEMINI_API_KEY</code>) are stored exclusively on your local FastAPI server in <code className="font-mono text-stone-800">backend/.env</code>. The browser client never transmits, exposes, or accesses raw secrets.
          </p>
        </div>

        {/* Provider Switch Modal */}
        {showProviderModal && (
          <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    AI Provider Configuration
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Model selection is managed via backend configuration.
                  </p>
                </div>
                <button
                  onClick={() => setShowProviderModal(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
                <p>
                  Inkloom AI is currently integrated with <strong className="text-stone-900">Google Gemini</strong> using the model <strong className="text-stone-900 font-mono">gemini-3.5-flash-lite</strong>.
                </p>
                <p>
                  To change providers or adjust models (e.g. OpenAI GPT-4o), update <code className="px-1.5 py-0.5 rounded bg-stone-100 font-mono text-[11px]">backend/.env</code> with your desired provider and key.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowProviderModal(false)}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-semibold"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
