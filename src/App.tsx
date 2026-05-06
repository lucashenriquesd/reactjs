import { useState, useRef, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import { getApiBaseUrl } from './config/api';

// ╔═══════════════════════════════════════════════════════════════════╗
// ║  GEMMA·4 NODE.02 — NETRUNNER UI                                   ║
// ║  Marathon-inspired chat surface, drop-in for App.tsx              ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ==== UUIDv7 ====
const generateUUIDv7 = () => {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  const ts = Date.now();
  bytes[0] = Math.floor(ts / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ts / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ts / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ts / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
};

const MAX_TOKENS = 256000;
const MOBILE = '@media (max-width: 768px)';
const apiUrl = `${getApiBaseUrl()}`;

type Message = { role: string; text: string };
type ChatSession = { id: string; title: string; messages: Message[]; updatedAt: number };

// Welcome messages — kept short, in NETRUNNER voice
const WELCOME_NORMAL = '◢ HANDSHAKE.COMPLETE\nNó local Gemma 4 pronto. Transmita um prompt.';
const WELCOME_STATELESS = '⚡ EPHEMERAL.MODE\nUma pergunta única — sem persistência. O contexto não atravessa o turno.';

export default function App() {
  const [prompt, setPrompt] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Stateless mode
  const [isStateless, setIsStateless] = useState(false);
  const [statelessLocked, setStatelessLocked] = useState(false);
  const [statelessChat, setStatelessChat] = useState<Message[]>([]);

  // Live tick for HUD animations (latency, uptime)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ==== SESSIONS (LOCALSTORAGE) ====
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('gemma-chats');
    if (saved) return JSON.parse(saved);

    const initId = generateUUIDv7();
    return [{
      id: initId,
      title: 'NEW.SESSION',
      messages: [{ role: 'ai', text: WELCOME_NORMAL }],
      updatedAt: Date.now(),
    }];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessions[0]?.id || null);

  useEffect(() => {
    localStorage.setItem('gemma-chats', JSON.stringify(sessions));
  }, [sessions]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const chat = isStateless ? statelessChat : (activeSession?.messages || []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [chat, isLoading, autoScroll]);

  // ==== ACTIONS ====
  const startNewChat = () => {
    const newId = generateUUIDv7();
    setSessions(prev => [{
      id: newId,
      title: 'NEW.SESSION',
      messages: [{ role: 'ai', text: WELCOME_NORMAL }],
      updatedAt: Date.now(),
    }, ...prev]);

    setActiveSessionId(newId);
    setIsStateless(false);
    setStatelessLocked(false);
    setPrompt('');
    setIsSidebarOpen(false);
  };

  const loadChat = (id: string) => {
    setActiveSessionId(id);
    setIsStateless(false);
    setStatelessLocked(false);
    setPrompt('');
    setIsSidebarOpen(false);
  };

  const deleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);

      if (!isStateless && activeSessionId === id) {
        if (filtered.length > 0) {
          setActiveSessionId(filtered[0].id);
        } else {
          const newId = generateUUIDv7();
          filtered.push({
            id: newId,
            title: 'NEW.SESSION',
            messages: [{ role: 'ai', text: WELCOME_NORMAL }],
            updatedAt: Date.now(),
          });
          setActiveSessionId(newId);
        }
      }
      return filtered;
    });
  };

  const startStatelessChat = () => {
    setIsStateless(true);
    setStatelessLocked(false);
    setPrompt('');
    setStatelessChat([{ role: 'ai', text: WELCOME_STATELESS }]);
    setIsSidebarOpen(false);
  };

  // ==== SEND ====
  const handleSend = async () => {
    if (!prompt.trim() || isLoading || isStreaming || statelessLocked) return;

    const userText = prompt;
    setPrompt('');
    setIsLoading(true);

    if (isStateless) {
      setStatelessChat((prev) => [...prev, { role: 'user', text: userText }]);
    } else {
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const isFirstUserMsg = s.messages.filter(m => m.role === 'user').length === 0;
          return {
            ...s,
            title: isFirstUserMsg ? userText.slice(0, 30) + (userText.length > 30 ? '...' : '') : s.title,
            messages: [...s.messages, { role: 'user', text: userText }],
            updatedAt: Date.now(),
          };
        }
        return s;
      }));
    }

    try {
      const validHistory = chat.filter(
        c => c.role === 'user' || (c.role === 'ai' && !c.text.includes('HANDSHAKE') && !c.text.includes('EPHEMERAL.MODE'))
      );

      let finalPrompt = userText;
      if (!isStateless && validHistory.length > 0) {
        const historyText = validHistory.map((msg) => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.text}`).join('\n');
        finalPrompt = `${historyText}\nUser: ${userText}\nAI:`;
      }

      // ==== STATELESS (no stream) ====
      if (isStateless) {
        const response = await fetch(`${apiUrl}/ollama/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gemma4', prompt: finalPrompt, history: [] }),
        });

        if (!response.ok) throw new Error(`API error: ${response.statusText}`);

        const responseJson = await response.json();
        const aiResponseText = responseJson.data?.response || responseJson.response || 'Resposta recebida';

        setStatelessChat((prev) => [...prev, { role: 'ai', text: aiResponseText }]);
        setStatelessLocked(true);
      }
      // ==== NORMAL (stream) ====
      else {
        const response = await fetch(`${apiUrl}/ollama/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gemma4', prompt: finalPrompt, history: validHistory }),
        });

        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        if (!response.body) throw new Error('A resposta não possui ReadableStream.');

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let isFirstChunk = true;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();

            if (!trimmedLine || trimmedLine.startsWith('id:') || trimmedLine.startsWith('event:')) continue;

            if (trimmedLine.startsWith('data:')) {
              const jsonString = trimmedLine.replace(/^data:/, '').trim();
              if (jsonString === '[DONE]') continue;

              try {
                const parsed = JSON.parse(jsonString);
                const textChunk = parsed.data ?? parsed.response ?? parsed.message?.content ?? '';

                if (textChunk) {
                  if (isFirstChunk) {
                    setIsLoading(false);
                    setIsStreaming(true);

                    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
                      ...s,
                      messages: [...s.messages, { role: 'ai', text: textChunk }],
                      updatedAt: Date.now(),
                    } : s));

                    isFirstChunk = false;
                  } else {
                    setSessions(prev => prev.map(s => {
                      if (s.id === activeSessionId) {
                        const newMsgs = [...s.messages];
                        newMsgs[newMsgs.length - 1] = {
                          ...newMsgs[newMsgs.length - 1],
                          text: newMsgs[newMsgs.length - 1].text + textChunk,
                        };
                        return { ...s, messages: newMsgs, updatedAt: Date.now() };
                      }
                      return s;
                    }));
                  }
                }
              } catch (e) {
                console.warn('Ignorando chunk inválido:', jsonString);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao chamar o NestJS:', error);
      const errorMsg = { role: 'ai', text: '◢ ERROR / FALHA NO UPLINK\nDesculpe, ocorreu um erro ao se comunicar com o servidor local.' };

      if (isStateless) {
        setStatelessChat(prev => [...prev, errorMsg]);
      } else {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMsg] } : s));
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const isInputDisabled = isLoading || isStreaming || statelessLocked;

  const validChatForCount = chat.filter(c => c.role === 'user' || (c.role === 'ai' && !c.text.includes('HANDSHAKE') && !c.text.includes('EPHEMERAL.MODE')));
  const currentContextText = validChatForCount.map(c => c.text).join(' ');

  const totalChars = isStateless ? prompt.length : currentContextText.length + prompt.length;
  const estimatedTokens = Math.ceil(totalChars / 4);
  const tokenPct = Math.min(100, (estimatedTokens / MAX_TOKENS) * 100);
  const isNearLimit = estimatedTokens > (MAX_TOKENS * 0.8);

  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  const turnCount = chat.filter(c => c.role === 'user').length;

  // Render single corner bracket
  const Bracket = ({ pos, color = '#00E5FF' }: { pos: 'tl' | 'tr' | 'bl' | 'br'; color?: string }) => (
    <span {...stylex.props(s.bracket, s[`bracket_${pos}`])} style={{ borderColor: color }} />
  );

  return (
    <div {...stylex.props(s.layout)}>

      {isSidebarOpen && (
        <div {...stylex.props(s.overlay)} onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ════════════ SIDEBAR ════════════ */}
      <aside {...stylex.props(s.sidebar, isSidebarOpen && s.sidebarOpen)}>

        <div {...stylex.props(s.brandBlock)}>
          <div {...stylex.props(s.brandRow)}>
            <div {...stylex.props(s.logo)}>
              <span>◢</span>
              <span {...stylex.props(s.logoPing)} />
            </div>
            <div>
              <div {...stylex.props(s.brandName)}>NODE.02</div>
              <div {...stylex.props(s.brandSub)}>RUNNER · LOCAL</div>
            </div>
          </div>

          <div {...stylex.props(s.metricList)}>
            <div {...stylex.props(s.metricRow)}><span>MODEL</span><span {...stylex.props(s.metricVal)}>gemma4:256k</span></div>
            <div {...stylex.props(s.metricRow)}><span>UPLINK</span><span {...stylex.props(s.metricLime)}>● ONLINE</span></div>
            <div {...stylex.props(s.metricRow)}><span>LATENCY</span><span {...stylex.props(s.metricVal)}>{14 + (tick % 3)}ms</span></div>
          </div>
        </div>

        <div {...stylex.props(s.actionStack)}>
          <button {...stylex.props(s.btnPrimary)} onClick={startNewChat}>
            <span>+ NEW.SESSION</span><span>↵</span>
          </button>
          <button
            {...stylex.props(s.btnGhost, isStateless && s.btnGhostActive)}
            onClick={startStatelessChat}
          >
            <span>⚡ STATELESS.MODE</span><span>{isStateless ? '◉' : '○'}</span>
          </button>
        </div>

        <div {...stylex.props(s.sectionLabel)}>
          <span>── SESSIONS</span>
          <span>{String(sessions.length).padStart(3, '0')}/∞</span>
        </div>

        <div {...stylex.props(s.historyList)}>
          {sortedSessions.map((session, i) => {
            const isActive = !isStateless && activeSessionId === session.id;
            return (
              <div
                key={session.id}
                {...stylex.props(s.row, isActive && s.rowActive)}
                onClick={() => loadChat(session.id)}
                title={session.title}
              >
                {isActive && (
                  <>
                    <Bracket pos="tl" />
                    <Bracket pos="br" />
                  </>
                )}
                <span {...stylex.props(s.rowIdx, isActive && s.rowIdxActive)}>
                  [{String(i + 1).padStart(2, '0')}]
                </span>
                <span {...stylex.props(s.rowTitle, isActive && s.rowTitleActive)}>
                  {session.title}
                </span>
                <button
                  {...stylex.props(s.deleteBtn)}
                  onClick={(e) => deleteChat(e, session.id)}
                  title="Apagar conversa"
                >×</button>
              </div>
            );
          })}
        </div>

        <div {...stylex.props(s.sidebarFoot)}>
          <span>v0.42.7</span>
          <span {...stylex.props(s.metricLime)}>SECURE ▣</span>
        </div>
      </aside>

      {/* ════════════ MAIN ════════════ */}
      <main {...stylex.props(s.main)}>

        {/* HEADER */}
        <header {...stylex.props(s.header)}>
          <button
            {...stylex.props(s.iconBtn, s.mobileOnly)}
            onClick={() => setIsSidebarOpen(true)}
            title="Abrir menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </button>

          <div {...stylex.props(s.headerLeft)}>
            <span {...stylex.props(s.headerCorner)}>◢◣</span>
            <span {...stylex.props(s.metaLabel)}>SESSION</span>
            <span {...stylex.props(s.metaVal)}>
              {isStateless ? 'EPHEMERAL.0xFF' : `0x${(activeSessionId || '').slice(0, 8).toUpperCase()}`}
            </span>
            {isStateless && <span {...stylex.props(s.badge)}>⚡ EPHEMERAL</span>}
          </div>

          <span {...stylex.props(s.headerRule)} />

          <div {...stylex.props(s.headerStats)}>
            <span>TURNS <span {...stylex.props(s.metricVal)}>{String(turnCount).padStart(2, '0')}</span></span>
            <span {...stylex.props(s.hideOnMobile)}>TOK <span {...stylex.props(s.metricVal)}>{estimatedTokens}</span></span>
            <span {...stylex.props(s.hideOnMobile)}>LAT <span {...stylex.props(s.metricLime)}>{14 + (tick % 3)}MS</span></span>
          </div>

          <button
            {...stylex.props(s.scrollToggle, autoScroll && s.scrollToggleActive)}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Desativar Auto-Scroll' : 'Ativar Auto-Scroll'}
          >
            <span>{autoScroll ? '◉' : '○'}</span>
            <span {...stylex.props(s.hideOnMobile)}>AUTO-SCROLL</span>
          </button>
        </header>

        {/* CHAT */}
        <div {...stylex.props(s.chatContainer)}>
          <div {...stylex.props(s.chatBracketsWrap)} aria-hidden>
            <Bracket pos="tl" color="rgba(232,230,223,0.42)" />
            <Bracket pos="tr" color="rgba(232,230,223,0.42)" />
            <Bracket pos="bl" color="rgba(232,230,223,0.42)" />
            <Bracket pos="br" color="rgba(232,230,223,0.42)" />
          </div>

          <div {...stylex.props(s.chatWrapper)}>
            {chat.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isWelcome = msg.text.includes('HANDSHAKE') || msg.text.includes('EPHEMERAL.MODE');

              if (isWelcome) {
                return (
                  <div key={index} {...stylex.props(s.welcomeBlock)}>
                    <div {...stylex.props(s.welcomeKicker)}>
                      ◢ {msg.text.split('\n')[0].replace('◢ ', '').replace('⚡ ', '')}
                    </div>
                    <h1 {...stylex.props(s.welcomeTitle)}>
                      Aguardando<br/>
                      <span {...stylex.props(s.welcomeAccent)}>transmissão</span>.
                    </h1>
                    <div {...stylex.props(s.welcomeMeta)}>
                      &gt; CONTEXT WINDOW · 256,000 TOKENS<br/>
                      &gt; PERSISTENCE   · LOCAL ONLY · NO CLOUD<br/>
                      &gt; READY         · <span {...stylex.props(s.cursor)}>█</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={index} {...stylex.props(s.msgCard, isUser ? s.msgUser : s.msgAi)}>
                  <Bracket pos="tr" color={isUser ? '#C8FF3D' : '#00E5FF'} />
                  <Bracket pos="bl" color={isUser ? '#C8FF3D' : '#00E5FF'} />

                  <div {...stylex.props(s.msgHeader, isUser ? s.msgHeaderUser : s.msgHeaderAi)}>
                    <span>{isUser ? '▶ OPERATOR' : '◢ GEMMA.AI'}</span>
                    <span {...stylex.props(s.msgRule)} />
                    <span {...stylex.props(s.msgMeta)}>TURN.{String(index + 1).padStart(3, '0')}</span>
                    <span {...stylex.props(s.msgMeta)}>·</span>
                    <span {...stylex.props(s.msgMeta)}>{Math.ceil(msg.text.length / 4)}T</span>
                  </div>

                  <div {...stylex.props(s.msgBody, isUser ? s.msgBodyUser : s.msgBodyAi)}>
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div {...stylex.props(s.processing)}>
                <span>◢ GEMMA.AI · </span>
                <span {...stylex.props(s.blink)}>PROCESSING ▮▮▮▯▯</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* CTX METER */}
        <div {...stylex.props(s.meterArea)}>
          <div {...stylex.props(s.meterRow)}>
            <span {...stylex.props(s.meterLabel)}>CTX.BUFFER</span>
            <div {...stylex.props(s.meterTrack)}>
              {Array.from({ length: 40 }).map((_, i) => {
                const filled = (i / 40) * 100 < tokenPct;
                return (
                  <div
                    key={i}
                    {...stylex.props(s.meterCell)}
                    style={{ background: filled ? (isNearLimit ? '#FF6B35' : '#00E5FF') : 'rgba(232,230,223,0.12)' }}
                  />
                );
              })}
            </div>
            <span {...stylex.props(s.metricVal)}>{estimatedTokens.toLocaleString('pt-BR')}</span>
            <span {...stylex.props(s.meterLabel)}>/ {MAX_TOKENS.toLocaleString('pt-BR')}</span>
          </div>
        </div>

        {/* INPUT */}
        <div {...stylex.props(s.inputArea)}>
          <div {...stylex.props(s.inputBox, isInputDisabled && s.inputBoxDisabled)}>
            <Bracket pos="tl" />
            <Bracket pos="tr" />
            <Bracket pos="bl" />
            <Bracket pos="br" />

            <div {...stylex.props(s.inputHud)}>
              <span>◢ INPUT.BUFFER · {prompt.length} CHARS</span>
              <span {...stylex.props(prompt.trim() ? s.metricLime : s.meterLabel)}>
                {prompt.trim() ? '● READY' : '○ EMPTY'}
              </span>
            </div>

            <div {...stylex.props(s.inputRow)}>
              <textarea
                {...stylex.props(s.textarea)}
                rows={1}
                placeholder={
                  statelessLocked
                    ? '// stateless turn complete'
                    : '> type prompt and press ↵ to transmit'
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isInputDisabled}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                {...stylex.props(s.sendBtn, !prompt.trim() && s.sendBtnDisabled)}
                onClick={handleSend}
                disabled={isInputDisabled || !prompt.trim()}
                title="Transmitir"
              >
                TRANSMIT ▶
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ╔═══════════════════════════════════════════════════════════════════╗
// ║  STYLEX                                                           ║
// ╚═══════════════════════════════════════════════════════════════════╝

const ACCENT = '#00E5FF';
const LIME = '#C8FF3D';
const WARN = '#FF6B35';
const INK = '#E8E6DF';
const BG = '#070707';
const RULE = 'rgba(232,230,223,0.12)';
const DIM = 'rgba(232,230,223,0.42)';

const s = stylex.create({
  layout: {
    display: 'grid',
    gridTemplateColumns: { default: '300px 1fr', [MOBILE]: '1fr' },
    height: '100svh',
    width: '100vw',
    position: 'fixed',    // <-- Fixação na tela! Impede rolagem do body.
    top: 0,
    left: 0,
    backgroundColor: BG,
    color: INK,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontSize: '13px',
    overflow: 'hidden',
    backgroundImage: 'repeating-linear-gradient(0deg, rgba(232,230,223,0.025) 0 1px, transparent 1px 3px)',
  },

  overlay: {
    display: { default: 'none', [MOBILE]: 'block' },
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 30,
  },

  // ─── SIDEBAR ─────────────────────────
  sidebar: {
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: RULE,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: BG,
    minHeight: 0, // <-- Previne o blowout do Grid
    flexShrink: 0,
    position: { default: 'static', [MOBILE]: 'fixed' },
    top: { [MOBILE]: 0 },
    bottom: { [MOBILE]: 0 },
    left: { [MOBILE]: 0 },
    width: { [MOBILE]: '300px' },
    zIndex: { [MOBILE]: 40 },
    transform: { default: 'none', [MOBILE]: 'translateX(-100%)' },
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  sidebarOpen: {
    transform: { [MOBILE]: 'translateX(0)' },
  },

  brandBlock: {
    padding: '16px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: RULE,
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  logo: {
    width: '30px',
    height: '30px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: ACCENT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: ACCENT,
    fontSize: '12px',
    position: 'relative',
  },
  logoPing: {
    position: 'absolute',
    top: '-3px',
    right: '-3px',
    width: '5px',
    height: '5px',
    backgroundColor: LIME,
    animationName: stylex.keyframes({
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.3 },
    }),
    animationDuration: '1.4s',
    animationIterationCount: 'infinite',
  },
  brandName: {
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: INK,
  },
  brandSub: {
    fontSize: '9px',
    color: DIM,
    letterSpacing: '0.16em',
  },
  metricList: {
    fontSize: '9px',
    letterSpacing: '0.14em',
    color: DIM,
    lineHeight: 1.7,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  metricVal: { color: INK },
  metricLime: { color: LIME },

  actionStack: {
    padding: '12px 12px 6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  btnPrimary: {
    padding: '10px 12px',
    backgroundColor: ACCENT,
    color: '#000',
    borderWidth: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '10px',
    letterSpacing: '0.18em',
    fontWeight: 700,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'opacity 0.15s',
    opacity: { default: 1, ':hover': 0.85 },
  },
  btnGhost: {
    padding: '10px 12px',
    backgroundColor: 'transparent',
    color: INK,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: RULE,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '10px',
    letterSpacing: '0.18em',
    fontWeight: 600,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'border-color 0.15s, color 0.15s',
  },
  btnGhostActive: {
    borderColor: LIME,
    color: LIME,
  },

  sectionLabel: {
    padding: '14px 16px 6px',
    fontSize: '9px',
    letterSpacing: '0.18em',
    color: DIM,
    display: 'flex',
    justifyContent: 'space-between',
  },

  historyList: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 0, // <-- Essencial para rolar apenas a lista
    overflowY: 'auto',
    padding: '4px 8px 8px',
    scrollbarWidth: 'none',
    '::-webkit-scrollbar': { display: 'none' },
  },
  row: {
    padding: '9px 10px',
    cursor: 'pointer',
    position: 'relative',
    marginBottom: '2px',
    backgroundColor: { default: 'transparent', ':hover': 'rgba(232,230,223,0.04)' },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background 0.15s, border-color 0.15s',
  },
  rowActive: {
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderColor: ACCENT,
  },
  rowIdx: {
    fontSize: '9px',
    color: DIM,
    letterSpacing: '0.1em',
    flexShrink: 0,
  },
  rowIdxActive: { color: ACCENT },
  rowTitle: {
    flex: 1,
    fontSize: '11px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'rgba(232,230,223,0.78)',
    letterSpacing: '0.02em',
  },
  rowTitleActive: { color: INK },
  deleteBtn: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: { default: DIM, ':hover': WARN },
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 4px',
    fontFamily: 'inherit',
    transition: 'color 0.15s',
  },

  sidebarFoot: {
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: RULE,
    padding: '10px 16px',
    fontSize: '9px',
    letterSpacing: '0.14em',
    color: DIM,
    display: 'flex',
    justifyContent: 'space-between',
  },

  // ─── MAIN ────────────────────────────
  main: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0, // <-- Previne o blowout (mantém dentro dos limites do grid)
    position: 'relative',
    width: { [MOBILE]: '100%' },
    height: '100%',
    boxSizing: 'border-box',
  },

  header: {
    padding: '12px 24px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: RULE,
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },
  headerCorner: { color: ACCENT, fontSize: '11px' },
  metaLabel: { fontSize: '10px', letterSpacing: '0.18em', color: DIM },
  metaVal: { fontSize: '11px', color: INK, letterSpacing: '0.06em' },
  headerRule: { flex: 1, height: '1px', backgroundColor: RULE },
  headerStats: {
    display: 'flex',
    gap: '14px',
    fontSize: '10px',
    letterSpacing: '0.16em',
    color: DIM,
  },

  badge: {
    marginLeft: '6px',
    padding: '2px 6px',
    backgroundColor: LIME,
    color: '#000',
    fontSize: '8px',
    letterSpacing: '0.16em',
    fontWeight: 700,
  },

  iconBtn: {
    background: 'none',
    borderWidth: 0,
    color: INK,
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: { default: 'transparent', ':hover': 'rgba(232,230,223,0.06)' },
    transition: 'background-color 0.2s',
  },
  mobileOnly: { display: { default: 'none', [MOBILE]: 'flex' } },
  hideOnMobile: { display: { default: 'inline', [MOBILE]: 'none' } },

  scrollToggle: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: RULE,
    backgroundColor: 'transparent',
    color: DIM,
    padding: '5px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '9px',
    letterSpacing: '0.16em',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'color 0.15s, border-color 0.15s',
  },
  scrollToggleActive: { color: ACCENT, borderColor: ACCENT },

  // ─── CHAT ────────────────────────────
  chatContainer: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 0, // <-- Essencial para que o flexbox role internamente
    overflowY: 'auto',
    padding: { default: '24px', [MOBILE]: '16px' },
    position: 'relative',
    scrollBehavior: 'smooth',
  },
  chatBracketsWrap: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    bottom: '12px',
    left: '12px',
    pointerEvents: 'none',
  },
  chatWrapper: {
    width: '100%',
    maxWidth: '820px',
    margin: '0 auto',
    position: 'relative',
  },

  welcomeBlock: { padding: '40px 0' },
  welcomeKicker: {
    fontSize: '9px',
    letterSpacing: '0.22em',
    color: ACCENT,
    marginBottom: '14px',
  },
  welcomeTitle: {
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
    fontSize: { default: '64px', [MOBILE]: '40px' },
    fontWeight: 700,
    letterSpacing: '-0.04em',
    lineHeight: 0.95,
    margin: 0,
    marginBottom: '18px',
    color: INK,
    textTransform: 'uppercase',
  },
  welcomeAccent: { color: ACCENT },
  welcomeMeta: {
    fontSize: '11px',
    letterSpacing: '0.1em',
    color: DIM,
    lineHeight: 1.7,
  },
  cursor: {
    color: ACCENT,
    animationName: stylex.keyframes({ '50%': { opacity: 0 } }),
    animationDuration: '0.7s',
    animationIterationCount: 'infinite',
    display: 'inline-block',
  },

  msgCard: {
    marginBottom: '22px',
    position: 'relative',
    padding: '12px 14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: RULE,
    borderLeftWidth: '2px',
  },
  msgUser: {
    backgroundColor: 'transparent',
    borderLeftColor: LIME,
  },
  msgAi: {
    backgroundColor: 'rgba(0,229,255,0.04)',
    borderLeftColor: ACCENT,
  },
  msgHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '9px',
    letterSpacing: '0.18em',
    marginBottom: '8px',
    fontWeight: 700,
  },
  msgHeaderUser: { color: LIME },
  msgHeaderAi: { color: ACCENT },
  msgRule: { flex: 1, height: '1px', backgroundColor: RULE },
  msgMeta: { color: DIM },

  msgBody: {
    fontSize: '13px',
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap',
    color: INK,
  },
  msgBodyUser: { fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
  msgBodyAi: { fontFamily: '"Space Grotesk", system-ui, sans-serif' },

  processing: {
    fontSize: '10px',
    letterSpacing: '0.18em',
    color: ACCENT,
    padding: '12px 14px',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: ACCENT,
  },
  blink: {
    animationName: stylex.keyframes({ '50%': { opacity: 0.4 } }),
    animationDuration: '0.8s',
    animationIterationCount: 'infinite',
  },

  // ─── METER ───────────────────────────
  meterArea: {
    padding: '8px 24px 6px',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: RULE,
  },
  meterRow: {
    maxWidth: '820px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '9px',
    letterSpacing: '0.16em',
  },
  meterLabel: { color: DIM },
  meterTrack: {
    flex: 1,
    display: 'flex',
    gap: '2px',
  },
  meterCell: {
    flex: 1,
    height: '8px',
    transition: 'background 0.2s',
  },

  // ─── INPUT ───────────────────────────
  inputArea: {
    padding: { default: '10px 24px 20px', [MOBILE]: '10px 16px 16px' },
  },
  inputBox: {
    maxWidth: '820px',
    margin: '0 auto',
    position: 'relative',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: ACCENT,
    backgroundColor: '#0A0A0A',
    transition: 'opacity 0.15s',
  },
  inputBoxDisabled: { opacity: 0.6 },
  inputHud: {
    padding: '6px 12px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: RULE,
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '9px',
    letterSpacing: '0.18em',
    color: DIM,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    borderWidth: 0,
    outline: 'none',
    backgroundColor: 'transparent',
    color: INK,
    padding: '12px 14px',
    fontFamily: 'inherit',
    fontSize: '13px',
    lineHeight: 1.5,
    minHeight: '24px',
    maxHeight: '200px',
    boxSizing: 'border-box',
    display: 'block',
  },
  sendBtn: {
    margin: '8px',
    padding: '10px 14px',
    backgroundColor: ACCENT,
    color: '#000',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: ACCENT,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '10px',
    letterSpacing: '0.18em',
    fontWeight: 700,
    transition: 'opacity 0.15s',
    opacity: { default: 1, ':hover': 0.85 },
  },
  sendBtnDisabled: {
    backgroundColor: 'transparent',
    color: DIM,
    borderColor: RULE,
    cursor: 'not-allowed',
    opacity: 1,
  },

  // ─── BRACKETS ────────────────────────
  bracket: {
    position: 'absolute',
    width: '8px',
    height: '8px',
    pointerEvents: 'none',
  },
  bracket_tl: {
    top: '-1px',
    left: '-1px',
    borderTopWidth: '1.5px',
    borderTopStyle: 'solid',
    borderLeftWidth: '1.5px',
    borderLeftStyle: 'solid',
  },
  bracket_tr: {
    top: '-1px',
    right: '-1px',
    borderTopWidth: '1.5px',
    borderTopStyle: 'solid',
    borderRightWidth: '1.5px',
    borderRightStyle: 'solid',
  },
  bracket_bl: {
    bottom: '-1px',
    left: '-1px',
    borderBottomWidth: '1.5px',
    borderBottomStyle: 'solid',
    borderLeftWidth: '1.5px',
    borderLeftStyle: 'solid',
  },
  bracket_br: {
    bottom: '-1px',
    right: '-1px',
    borderBottomWidth: '1.5px',
    borderBottomStyle: 'solid',
    borderRightWidth: '1.5px',
    borderRightStyle: 'solid',
  },
});
