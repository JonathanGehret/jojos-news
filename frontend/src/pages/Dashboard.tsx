import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, AlertCircle, CheckCircle } from 'lucide-react';

interface Summary {
  id: string;
  date: string;
  day_of_week: string;
  topic_name: string;
  content: string;
  generated_at: string;
}

export const Dashboard: React.FC = () => {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummaries();
  }, [date]);

  const fetchSummaries = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/summaries', {
        params: { date },
      });
      setSummaries(response.data.summaries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch summaries');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-blue-600" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <span className="text-gray-600 flex-grow">{formatDate(date)}</span>
          <button
            onClick={() => setDate(new Date().toISOString().split('T')[0])}
            className="button-secondary"
          >
            Today
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading summaries...</p>
        </div>
      )}

      {/* Summaries Display */}
      {!loading && summaries.length > 0 && (
        <div className="space-y-4">
          {summaries.map((summary) => (
            <div key={summary.id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-xl font-bold text-gray-900">{summary.topic_name}</h2>
                <span className="inline-block px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full">
                  {summary.day_of_week}
                </span>
              </div>
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                {summary.content.split('\n').map((para, idx) => (
                  <p key={idx} className="mb-2">
                    {para}
                  </p>
                ))}
              </div>
              <div className="mt-4 text-xs text-gray-500">
                Generated: {new Date(summary.generated_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && summaries.length === 0 && !error && (
        <div className="card p-8 text-center text-gray-500">
          <p>No summaries available for {formatDate(date)}</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
