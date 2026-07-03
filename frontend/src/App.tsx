import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import EmailLogs from './pages/EmailLogs';
import { Newspaper, Settings, Mail } from 'lucide-react';
import './index.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin' | 'logs'>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-2xl font-bold text-gray-900">Jojo's News Digest</h1>
            <p className="text-gray-600">AI-Powered Daily News Aggregator</p>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="container">
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Newspaper className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'admin'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              Admin
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'logs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mail className="w-4 h-4" />
              Email Logs
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="container">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'admin' && <Admin />}
        {activeTab === 'logs' && <EmailLogs />}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 text-center py-8 mt-12">
        <p>© 2024 Jojo's News Aggregator • Powered by Ollama, Resend & Open Data Sources</p>
      </footer>
    </div>
  );
};

export default App;
