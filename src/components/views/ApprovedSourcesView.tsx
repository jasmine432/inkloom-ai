import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Plus,
  MoreVertical,
  X,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import booksImg from '../../assets/sources_books.jpg';
import { APPROVED_SOURCES } from '../../data/sampleSources';
import { fetchBackendSources } from '../../services/api';
import { TopographicCurves } from '../TopographicCurves';
import type { ApprovedSource } from '../../types';

export const ApprovedSourcesView: React.FC = () => {
  const [sources, setSources] = useState<ApprovedSource[]>(APPROVED_SOURCES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<ApprovedSource | null>(null);
  const [showAddInfo, setShowAddInfo] = useState(false);

  // Fetch live sources from backend if available
  useEffect(() => {
    fetchBackendSources().then((backendList) => {
      if (backendList && backendList.length > 0) {
        setSources(backendList);
      }
    });
  }, []);

  const filteredSources = sources.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative min-h-full pb-16">
      {/* Topographic line-art in top-right */}
      <TopographicCurves />

      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-6 sm:py-8 space-y-8 relative z-10">
        {/* Header & Add Source Button matching reference Screen 4 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-stone-200 text-stone-600 text-xs font-medium shadow-2xs">
              <span>Your knowledge base</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight font-sans">
              Trusted sources
            </h1>

            <p className="text-sm text-stone-600">
              These sources are used to verify your content.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={() => setShowAddInfo(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white font-semibold text-xs shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add source</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sources by title or category..."
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-stone-200/90 rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 shadow-xs transition-all"
          />
        </div>

        {/* Source Cards List matching reference Screen 4 */}
        <div className="space-y-3">
          {filteredSources.map((source) => (
            <div
              key={source.id}
              onClick={() => setSelectedSource(source)}
              className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs hover:border-stone-300 transition-all flex items-center justify-between gap-4 cursor-pointer"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">
                    {source.title}
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {source.category.includes('Legal') ? 'PDF • Updated 2 weeks ago' : 'PDF • Updated 1 month ago'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
                  aria-label="Source options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Banner Card matching reference Screen 4 */}
        <div
          onClick={() => setShowAddInfo(true)}
          className="bg-white rounded-2xl border border-stone-200/80 p-4 sm:p-5 shadow-xs flex items-center justify-between gap-5 hover:border-stone-300 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
              <img
                src={booksImg}
                alt="Stack of linen books with succulent plant"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                Keep your sources up to date
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                Add company documents, guidelines, and references for better results.
              </p>
            </div>
          </div>

          <div className="shrink-0 text-stone-400">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>

        {/* Inspect Source Modal */}
        {selectedSource && (
          <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200 space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
                <div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                    {selectedSource.category}
                  </span>
                  <h3 className="text-lg font-bold text-stone-900 mt-1">
                    {selectedSource.title}
                  </h3>
                  <p className="text-xs text-stone-500 font-mono mt-0.5">
                    {selectedSource.version} • {selectedSource.owner}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed m-0">
                {selectedSource.description}
              </p>

              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700 font-mono">
                  Verified Guidelines & Benchmarks ({selectedSource.verifiedClaims.length})
                </span>
                <div className="space-y-1.5">
                  {selectedSource.verifiedClaims.map((claim, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800 flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{claim}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex justify-end">
                <button
                  onClick={() => setSelectedSource(null)}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Source Notice Modal */}
        {showAddInfo && (
          <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Trusted Knowledge Base
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Guideline documents are managed in your backend repository directory (<code className="px-1 py-0.5 rounded bg-stone-100 font-mono text-[11px]">backend/data/sources/</code>).
                  </p>
                </div>
                <button
                  onClick={() => setShowAddInfo(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">
                To connect new guidelines, place your approved PDF or Markdown source documents in the backend repository. The FastAPI server automatically re-indexes them for real-time citation extraction and verification.
              </p>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowAddInfo(false)}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-semibold"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
