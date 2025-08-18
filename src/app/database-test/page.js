'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DatabaseTest() {
  const [dbStatus, setDbStatus] = useState('Checking...');
  const [tables, setTables] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    testDatabase();
  }, []);

  const testDatabase = async () => {
    try {
      // Test basic connection
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('count')
        .limit(1);

      if (roomsError) {
        throw new Error(`Rooms table error: ${roomsError.message}`);
      }

      // Test all required tables
      const tableTests = [
        'rooms', 'players', 'game_sessions', 'rounds', 
        'player_answers', 'scores', 'tic_tac_toe_moves'
      ];

      const tableResults = [];
      for (const table of tableTests) {
        try {
          const { error } = await supabase
            .from(table)
            .select('*')
            .limit(1);
          
          tableResults.push({
            table,
            status: error ? `❌ ${error.message}` : '✅ OK'
          });
        } catch (err) {
          tableResults.push({
            table,
            status: `❌ ${err.message}`
          });
        }
      }

      setTables(tableResults);
      setDbStatus('✅ Database connection successful');
    } catch (error) {
      setError(error.message);
      setDbStatus('❌ Database connection failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
            Database Connection Test
          </h1>
          
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Status:</h2>
            <p className="text-lg">{dbStatus}</p>
            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Table Status:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tables.map(({ table, status }) => (
                <div key={table} className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="font-medium text-slate-900 dark:text-white">{table}</div>
                  <div className="text-sm">{status}</div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-6 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">
                🚧 Database Setup Required
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300 mb-4">
                It looks like your database tables haven't been created yet. Please follow these steps:
              </p>
              <ol className="list-decimal list-inside text-yellow-700 dark:text-yellow-300 space-y-2">
                <li>Go to your Supabase dashboard</li>
                <li>Open the SQL Editor</li>
                <li>Copy and run the SQL from <code>database_schema.sql</code></li>
                <li>Refresh this page to test again</li>
              </ol>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={testDatabase}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg mr-4"
            >
              🔄 Test Again
            </button>
            <a
              href="/"
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 
                       text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg"
            >
              🏠 Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
