import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle } from 'lucide-react';

interface Preferences {
  keywords: string[];
  excludeKeywords?: string[];
  preferredSources: string[];
  style: 'brief' | 'detailed' | 'balanced';
}

export const Admin: React.FC = () => {
  const [preferences, setPreferences] = useState<Preferences>({
    keywords: [],
    excludeKeywords: [],
    preferredSources: ['twitter', 'rss', 'reddit'],
    style: 'balanced',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/preferences');
      setPreferences(response.data);
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to load preferences',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.patch('/api/preferences', preferences);
      setMessage({
        type: 'success',
        text: 'Preferences saved successfully',
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to save preferences',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleKeywordChange = (keywords: string) => {
    setPreferences({
      ...preferences,
      keywords: keywords.split(',').map((k) => k.trim()),
    });
  };

  const handleSourceToggle = (source: string) => {
    setPreferences({
      ...preferences,
      preferredSources: preferences.preferredSources.includes(source)
        ? preferences.preferredSources.filter((s) => s !== source)
        : [...preferences.preferredSources, source],
    });
  };

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Messages */}
      {message && (
        <div className={`card p-4 ${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 ${message.type === 'success' ? 'text-green-600' : 'text-red-600'} flex-shrink-0 mt-0.5`} />
            <p className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>{message.text}</p>
          </div>
        </div>
      )}

      {/* News Sources */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">News Sources</h2>
        <div className="space-y-3">
          {['twitter', 'rss', 'reddit'].map((source) => (
            <label key={source} className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.preferredSources.includes(source)}
                onChange={() => handleSourceToggle(source)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="ml-3 capitalize text-gray-700">{source} API</span>
            </label>
          ))}
        </div>
      </div>

      {/* Keywords Configuration */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Keywords (Comma-separated)</h2>
        <textarea
          value={preferences.keywords.join(', ')}
          onChange={(e) => handleKeywordChange(e.target.value)}
          placeholder="e.g., Musk, Trump, AI, Germany, Politics"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          rows={4}
        />
        <p className="mt-2 text-sm text-gray-500">
          These keywords will be used to filter news across all sources.
        </p>
      </div>

      {/* Reporting Style */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Reporting Style</h2>
        <div className="space-y-3">
          {(['brief', 'balanced', 'detailed'] as const).map((style) => (
            <label key={style} className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="style"
                value={style}
                checked={preferences.style === style}
                onChange={() => setPreferences({ ...preferences, style })}
                className="w-4 h-4"
              />
              <span className="ml-3 capitalize text-gray-700">
                {style}
                {style === 'brief' && ' - Concise summaries'}
                {style === 'balanced' && ' - Moderate detail'}
                {style === 'detailed' && ' - Comprehensive coverage'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="button-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};

export default Admin;
