import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface EmailLog {
  id: string;
  date: string;
  recipient: string;
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at: string | null;
  error: string | null;
}

export const EmailLogs: React.FC = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/logs', {
        params: { limit: 20, offset: page * 20 },
      });
      setLogs(response.data.logs);
    } catch (error) {
      console.error('Failed to fetch logs', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-yellow-50 border-yellow-200';
    }
  };

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Recipient</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Subject</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Sent At</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className={`border-b border-gray-100 ${getStatusColor(log.status)}`}>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {new Date(log.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{log.recipient}</td>
                <td className="px-4 py-3 text-sm text-gray-700 truncate max-w-xs">{log.subject}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(log.status)}
                    <span className="capitalize font-medium">{log.status}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {log.sent_at ? new Date(log.sent_at).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length === 0 && (
        <div className="card p-8 text-center text-gray-500">
          <p>No email logs available</p>
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="button-secondary disabled:opacity-50"
        >
          Previous
        </button>
        <span className="px-4 py-2 text-gray-600">Page {page + 1}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={logs.length < 20}
          className="button-secondary disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default EmailLogs;
