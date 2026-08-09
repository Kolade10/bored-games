'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Send, X } from 'lucide-react';

const MAX_LENGTH = 500;

// Postgres "relation does not exist" / PostgREST "table not found in schema".
const MISSING_TABLE = new Set(['42P01', 'PGRST205']);

/**
 * Chat panel for everyone in a room, players and spectators alike. Rendered as
 * a floating button so it can sit over the lobby and both games without
 * disturbing their layouts.
 */
export default function RoomChat({ room, currentPlayer }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');

  const listRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;

  const roomId = room?.id;

  const loadMessages = useCallback(async () => {
    if (!roomId) return;

    const { data, error: loadError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (loadError) {
      if (MISSING_TABLE.has(loadError.code)) {
        setUnavailable(true);
      } else {
        console.error('Error loading messages:', loadError);
      }
      return;
    }

    setUnavailable(false);
    setMessages(data || []);
  }, [roomId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const message = payload.new;
        if (!message) return;

        setMessages(prev =>
          prev.some(m => m.id === message.id) ? prev : [...prev, message]
        );

        // Only count messages that arrive while the panel is shut, and never
        // our own - those are already on screen.
        if (!openRef.current && message.player_id !== currentPlayer?.id) {
          setUnread(count => count + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentPlayer?.id]);

  // Stick to the newest message.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  const send = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !currentPlayer || sending) return;

    setSending(true);
    setError('');
    setDraft('');

    const { error: sendError } = await supabase.from('chat_messages').insert({
      room_id: roomId,
      player_id: currentPlayer.id,
      player_name: currentPlayer.name,
      body: body.slice(0, MAX_LENGTH)
    });

    if (sendError) {
      console.error('Error sending message:', sendError);
      if (MISSING_TABLE.has(sendError.code)) {
        setUnavailable(true);
      } else {
        setError('Message not sent. Try again.');
        setDraft(body);
      }
    }

    setSending(false);
  };

  if (!roomId || unavailable) return null;

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="btn btn-amber fixed bottom-4 right-4 z-40 rounded-full w-14 h-14 p-0"
      >
        {open
          ? <X className="w-6 h-6" strokeWidth={3} />
          : <MessageCircle className="w-6 h-6" strokeWidth={2.5} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full bg-coral
                           text-[var(--on-coral)] border-2 border-line text-xs font-extrabold
                           flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card fixed z-40 flex flex-col overflow-hidden
                        bottom-20 right-4 left-4 sm:left-auto sm:w-[22rem]
                        max-h-[min(70vh,32rem)]">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b-2 border-line bg-sunken">
            <h2 className="text-base">Room chat</h2>
            <span className="text-xs font-bold text-ink-soft">{room.room_code}</span>
          </div>

          <div ref={listRef} className="grow overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <p className="text-sm text-ink-soft font-semibold text-center py-6">
                No messages yet. Say hello.
              </p>
            ) : (
              messages.map(message => {
                const mine = message.player_id === currentPlayer?.id;
                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-xl border-2 border-line
                                     ${mine ? 'bg-amber-soft' : 'bg-sunken'}`}>
                      {!mine && (
                        <p className="text-xs font-extrabold text-ink-soft mb-0.5">
                          {message.player_name}
                        </p>
                      )}
                      <p className="text-sm font-semibold break-words whitespace-pre-wrap">
                        {message.body}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {currentPlayer ? (
            <form onSubmit={send} className="p-3 border-t-2 border-line flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message the room..."
                maxLength={MAX_LENGTH}
                className="field grow"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="btn btn-teal shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" strokeWidth={3} />
              </button>
            </form>
          ) : (
            <p className="p-3 border-t-2 border-line text-sm font-semibold text-ink-soft text-center">
              Join the room to chat.
            </p>
          )}

          {error && (
            <p className="px-3 pb-3 text-xs font-bold text-coral">{error}</p>
          )}
        </div>
      )}
    </>
  );
}
