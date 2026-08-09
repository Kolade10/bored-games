'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  ArrowLeft, Check, CircleAlert, Database, Loader, RefreshCw, X
} from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';

const REQUIRED_TABLES = [
  'rooms', 'players', 'game_sessions', 'rounds',
  'player_answers', 'scores', 'tic_tac_toe_moves'
];

export default function DatabaseTest() {
  const [status, setStatus] = useState('checking');
  const [tables, setTables] = useState([]);
  const [error, setError] = useState('');

  const testDatabase = useCallback(async () => {
    setStatus('checking');
    setError('');
    setTables([]);

    try {
      const results = await Promise.all(
        REQUIRED_TABLES.map(async (table) => {
          const { error: tableError } = await supabase.from(table).select('*').limit(1);
          return { table, ok: !tableError, message: tableError?.message || 'Reachable' };
        })
      );

      setTables(results);
      const allOk = results.every(r => r.ok);
      setStatus(allOk ? 'ok' : 'failed');
      if (!allOk) {
        setError(results.find(r => !r.ok)?.message || 'One or more tables are missing.');
      }
    } catch (err) {
      setError(err.message);
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    testDatabase();
  }, [testDatabase]);

  const banner = {
    checking: { chip: 'chip', label: 'Checking connection...', Icon: Loader },
    ok: { chip: 'chip chip-leaf', label: 'Connected', Icon: Check },
    failed: { chip: 'chip chip-coral', label: 'Connection problem', Icon: CircleAlert }
  }[status];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <span className="w-12 h-12 rounded-xl bg-teal border-2 border-line flex items-center justify-center">
            <Database className="w-6 h-6 text-[var(--on-teal)]" strokeWidth={2.5} />
          </span>
          <h1 className="text-3xl lg:text-4xl">Database check</h1>
        </div>
        <p className="text-ink-soft mb-4">
          Confirms the app can reach every table the games rely on.
        </p>
        <span className={`${banner.chip} mb-8`}>
          <banner.Icon
            className={`w-4 h-4 ${status === 'checking' ? 'animate-spin' : ''}`}
            strokeWidth={2.5}
          />
          {banner.label}
        </span>

        <div className="card overflow-hidden mb-6">
          {tables.length === 0 ? (
            <div className="p-6 text-ink-soft font-semibold">Running checks...</div>
          ) : (
            <ul>
              {tables.map(({ table, ok, message }) => (
                <li
                  key={table}
                  className="flex items-center justify-between gap-4 px-5 py-3 border-b-2 border-line last:border-b-0"
                >
                  <code className="font-mono font-bold">{table}</code>
                  <span className={`chip ${ok ? 'chip-leaf' : 'chip-coral'}`}>
                    {ok
                      ? <Check className="w-4 h-4" strokeWidth={3} />
                      : <X className="w-4 h-4" strokeWidth={3} />}
                    <span className="max-w-[16rem] truncate">{ok ? 'OK' : message}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {status === 'failed' && (
          <div className="card p-6 mb-6 bg-coral-soft">
            <h2 className="text-lg mb-2">Setup needed</h2>
            <p className="text-sm mb-3">{error}</p>
            <ol className="text-sm list-decimal list-inside space-y-1 font-semibold">
              <li>Open your Supabase dashboard and go to the SQL Editor</li>
              <li>Paste and run the contents of <code className="font-mono">database_schema.sql</code></li>
              <li>Then run <code className="font-mono">database_migration_2.sql</code></li>
              <li>Check that <code className="font-mono">.env.local</code> has the right project URL and key</li>
              <li>Restart the dev server and re-run this check</li>
            </ol>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button onClick={testDatabase} className="btn btn-teal" disabled={status === 'checking'}>
            <RefreshCw className={`w-4 h-4 ${status === 'checking' ? 'animate-spin' : ''}`} strokeWidth={3} />
            Run again
          </button>
          <Link href="/" className="btn btn-quiet">
            <ArrowLeft className="w-4 h-4" strokeWidth={3} />
            Back to games
          </Link>
        </div>
      </div>
    </div>
  );
}
