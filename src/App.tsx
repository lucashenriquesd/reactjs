import { useState, useRef, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import { getApiBaseUrl } from './config/api';

// ==== GERADOR DE UUIDv7 NATIVO ====
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
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // Version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
};

// Limite do Gemma 4
const MAX_TOKENS = 256000; 
const MOBILE = '@media (max-width: 768px)';
const apiUrl = `${getApiBaseUrl()}`;

type Message = { role: string; text: string };
type ChatSession = { id: string; title: string; messages: Message[]; updatedAt: number };

export default function App() {
  const [prompt, setPrompt] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Estados Stateless (Efêmeros)
  const [isStateless, setIsStateless] = useState(false);
  const [statelessLocked, setStatelessLocked] = useState(false);
  const [statelessChat, setStatelessChat] = useState<Message[]>([]);

  // ==== GERENCIAMENTO DE SESSÕES (LOCALSTORAGE) ====
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('gemma-chats');
    if (saved) return JSON.parse(saved);
    
    // Se não houver histórico, cria a primeira conversa
    const initId = generateUUIDv7();
    return [{
      id: initId,
      title: 'Nova Conversa',
      messages: [{ role: 'ai', text: 'Olá! Sou seu assistente local (Gemma 4). Como posso ajudar?' }],
      updatedAt: Date.now()
    }];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessions[0]?.id || null);

  // Salva no LocalStorage sempre que 'sessions' for atualizado
  useEffect(() => {
    localStorage.setItem('gemma-chats', JSON.stringify(sessions));
  }, [sessions]);

  // Deriva o chat atual para renderização baseada no modo escolhido
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const chat = isStateless ? statelessChat : (activeSession?.messages || []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll da tela
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [chat, isLoading, autoScroll]);

  // ==== AÇÕES DO MENU ====
  const startNewChat = () => {
    const newId = generateUUIDv7();
    setSessions(prev => [{
      id: newId,
      title: 'Nova Conversa',
      messages: [{ role: 'ai', text: 'Olá! Sou seu assistente local (Gemma 4). Como posso ajudar?' }],
      updatedAt: Date.now()
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
    e.stopPropagation(); // Impede de selecionar a conversa ao clicar na lixeira
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      
      // Se apagou a conversa atual e está no modo normal, muda para a próxima disponível
      if (!isStateless && activeSessionId === id) {
        if (filtered.length > 0) {
          setActiveSessionId(filtered[0].id);
        } else {
          // Se apagou tudo, cria uma nova limpa
          const newId = generateUUIDv7();
          filtered.push({
            id: newId,
            title: 'Nova Conversa',
            messages: [{ role: 'ai', text: 'Olá! Sou seu assistente local (Gemma 4). Como posso ajudar?' }],
            updatedAt: Date.now()
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
    setStatelessChat([{ role: 'ai', text: 'Modo Stateless ativo ⚡\nFaça uma pergunta única. O contexto não será salvo para a próxima interação.' }]);
    setIsSidebarOpen(false);
  };

  // ==== ENVIO DE MENSAGENS ====
  const handleSend = async () => {
    if (!prompt.trim() || isLoading || isStreaming || statelessLocked) return;

    const userText = prompt;
    setPrompt(''); 
    setIsLoading(true);

    // Salva a mensagem do usuário imediatamente
    if (isStateless) {
      setStatelessChat((prev) => [...prev, { role: 'user', text: userText }]);
    } else {
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const isFirstUserMsg = s.messages.filter(m => m.role === 'user').length === 0;
          return {
            ...s,
            // Atualiza o título da conversa baseado na primeira mensagem
            title: isFirstUserMsg ? userText.slice(0, 30) + (userText.length > 30 ? '...' : '') : s.title,
            messages: [...s.messages, { role: 'user', text: userText }],
            updatedAt: Date.now()
          };
        }
        return s;
      }));
    }

    try {
      const validHistory = chat.filter(
        c => c.role === 'user' || (c.role === 'ai' && !c.text.includes('Olá! Sou seu') && !c.text.includes('Modo Stateless'))
      );

      let finalPrompt = userText;
      if (!isStateless && validHistory.length > 0) {
        const historyText = validHistory.map((msg) => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.text}`).join('\n');
        finalPrompt = `${historyText}\nUser: ${userText}\nAI:`;
      }

      // ==== MODO STATELESS (Sem Stream) ====
      if (isStateless) {
        const response = await fetch(`${apiUrl}/ollama/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gemma4', prompt: finalPrompt, history: [] }),
        });

        if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);

        const responseJson = await response.json();
        const aiResponseText = responseJson.data?.response || responseJson.response || "Resposta recebida";

        setStatelessChat((prev) => [...prev, { role: 'ai', text: aiResponseText }]);
        setStatelessLocked(true);
      } 
      
      // ==== MODO NORMAL (Com Stream e Persistência) ====
      else {
        const response = await fetch(`${apiUrl}/ollama/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gemma4', prompt: finalPrompt, history: validHistory }),
        });

        if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);
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
                    
                    // Adiciona o primeiro pedaço de texto da IA
                    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
                      ...s,
                      messages: [...s.messages, { role: 'ai', text: textChunk }],
                      updatedAt: Date.now()
                    } : s));
                    
                    isFirstChunk = false;
                  } else {
                    // Concatena os pedaços seguintes
                    setSessions(prev => prev.map(s => {
                      if (s.id === activeSessionId) {
                        const newMsgs = [...s.messages];
                        newMsgs[newMsgs.length - 1] = {
                          ...newMsgs[newMsgs.length - 1],
                          text: newMsgs[newMsgs.length - 1].text + textChunk
                        };
                        return { ...s, messages: newMsgs, updatedAt: Date.now() };
                      }
                      return s;
                    }));
                  }
                }
              } catch (e) {
                console.warn("Ignorando chunk inválido:", jsonString);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao chamar o NestJS:', error);
      const errorMsg = { role: 'ai', text: 'Desculpe, ocorreu um erro ao se comunicar com o servidor local.' };
      
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

  const validChatForCount = chat.filter(c => c.role === 'user' || (c.role === 'ai' && !c.text.includes('Olá!') && !c.text.includes('Modo Stateless')));
  const currentContextText = validChatForCount.map(c => c.text).join(' ');
  
  const totalChars = isStateless ? prompt.length : currentContextText.length + prompt.length;
  const estimatedTokens = Math.ceil(totalChars / 4);
  const isNearLimit = estimatedTokens > (MAX_TOKENS * 0.8);

  // Ordena conversas por última atualização
  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div {...stylex.props(s.layout)}>
      
      {isSidebarOpen && (
        <div 
          {...stylex.props(s.overlay)} 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside {...stylex.props(s.sidebar, isSidebarOpen && s.sidebarOpen)}>
        <button {...stylex.props(s.newChatBtn)} onClick={startNewChat}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Novo chat normal
        </button>

        <button 
          {...stylex.props(s.chatItemWrapper, s.statelessItemBtn, isStateless && s.activeItem)} 
          onClick={startStatelessChat}
        >
          <span style={{ fontSize: '18px' }}>⚡</span>
          Modo Stateless
        </button>
        
        <div {...stylex.props(s.historyTitle)}>Recentes</div>
        
        {/* LISTA DE CONVERSAS */}
        <div {...stylex.props(s.historyList)}>
          {sortedSessions.map((session) => (
            <div key={session.id} {...stylex.props(s.chatItemWrapper, !isStateless && activeSessionId === session.id && s.activeItem)}>
              <button 
                {...stylex.props(s.chatItemBtn)} 
                onClick={() => loadChat(session.id)}
                title={session.title}
              >
                {session.title}
              </button>
              
              <button 
                {...stylex.props(s.deleteBtn)} 
                onClick={(e) => deleteChat(e, session.id)}
                title="Apagar conversa"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main {...stylex.props(s.main)}>
        <header {...stylex.props(s.header)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              {...stylex.props(s.iconBtn, s.mobileOnly)} 
              onClick={() => setIsSidebarOpen(true)}
              title="Abrir menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
              </svg>
            </button>
            
            <span>Gemma 4 Local</span>
            {isStateless && <span {...stylex.props(s.badge)}>Stateless</span>}
          </div>

          <button 
            {...stylex.props(s.scrollToggleBtn, autoScroll && s.scrollToggleActive)} 
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? "Desativar Rolagem Automática" : "Ativar Rolagem Automática"}
          >
            {autoScroll ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            )}
            <span {...stylex.props(s.hideOnMobile)}>Auto Scroll</span>
          </button>
        </header>

        <div {...stylex.props(s.chatContainer)}>
          <div {...stylex.props(s.chatWrapper)}>
            {chat.map((msg, index) => (
              <div key={index} {...stylex.props(s.messageRow, msg.role === 'user' && s.messageRowUser)}>
                <div {...stylex.props(s.avatar, msg.role === 'ai' ? s.avatarAi : s.avatarUser)}>
                  {msg.role === 'ai' ? '✦' : 'U'}
                </div>
                <div {...stylex.props(s.messageBubble, msg.role === 'ai' ? s.bubbleAi : s.bubbleUser)} style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div {...stylex.props(s.messageRow)}>
                <div {...stylex.props(s.avatar, s.avatarAi)}>✦</div>
                <div {...stylex.props(s.messageBubble, s.bubbleAi)}>
                  <span style={{ opacity: 0.6 }}>Pensando...</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div {...stylex.props(s.inputArea)}>
          <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            <div {...stylex.props(s.tokenInfo, isNearLimit && s.tokenWarning)}>
              <span>{isStateless ? 'Contexto: 0' : 'Contexto salvo'}</span>
              <span>
                ~{estimatedTokens.toLocaleString('pt-BR')} / {MAX_TOKENS.toLocaleString('pt-BR')} tokens
              </span>
            </div>

            <div {...stylex.props(s.inputWrapper, isInputDisabled && s.inputWrapperDisabled)}>
              <textarea
                {...stylex.props(s.textarea)}
                rows={1}
                placeholder={
                  statelessLocked 
                    ? "Modo Stateless concluído." 
                    : "Digite um prompt aqui"
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
                {...stylex.props(s.iconBtn, s.sendBtnColor, isInputDisabled && s.iconBtnDisabled)} 
                onClick={handleSend} 
                disabled={isInputDisabled}
                title="Enviar"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const s = stylex.create({
  layout: {
    display: 'flex',
    height: '100svh', 
    width: '100vw',
    backgroundColor: '#131314', 
    color: '#e3e3e3',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    overflow: 'hidden',
  },
  
  overlay: {
    display: { default: 'none', [MOBILE]: 'block' },
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 30,
  },

  sidebar: {
    width: { default: '280px', [MOBILE]: '260px' },
    backgroundColor: '#1e1f20',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    boxSizing: 'border-box',
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: '#333',
    flexShrink: 0,
    position: { default: 'static', [MOBILE]: 'fixed' },
    top: { [MOBILE]: 0 },
    bottom: { [MOBILE]: 0 },
    left: { [MOBILE]: 0 },
    zIndex: { [MOBILE]: 40 },
    transform: { default: 'none', [MOBILE]: 'translateX(-100%)' },
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  sidebarOpen: {
    transform: { [MOBILE]: 'translateX(0)' },
  },

  newChatBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    color: '#e3e3e3',
    borderWidth: 0,
    borderRadius: '24px', // Formato de pílula
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '16px',
    transition: 'background-color 0.2s',
    backgroundColor: { 
      default: '#282a2c', 
      ':hover': '#333538' 
    },
  },
  historyTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#c4c7c5',
    marginBottom: '12px',
    paddingInline: '16px', // Alinhado com o botão
  },
  
  // ÁREA DE LISTA DE HISTÓRICO COM SCROLL
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px', // Mais juntos, estilo Gemini
    overflowY: 'auto',
    flexGrow: 1,
    // Esconder barra de rolagem (opcional, deixa mais limpo)
    scrollbarWidth: 'none', 
    '::-webkit-scrollbar': { display: 'none' }
  },

  // ==== NOVO ESTILO DOS ITENS DO MENU ====
  chatItemWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '24px',
    backgroundColor: { default: 'transparent', ':hover': '#004a77' }, 
    color: { default: '#e3e3e3', ':hover': '#c2e7ff' }, 
    transition: 'background-color 0.2s, color 0.2s',
    overflow: 'hidden',
  },
  statelessItemBtn: {
    marginBottom: '24px',
    padding: '12px 16px',
    cursor: 'pointer',
    backgroundColor: 'transparent', // <-- CORREÇÃO AQUI (Força o fundo ficar invisível)
    borderWidth: 0,
    color: 'inherit',
    justifyContent: 'flex-start',
    gap: '8px',
  },
  chatItemBtn: {
    padding: '12px 16px', 
    paddingRight: '40px', 
    backgroundColor: 'transparent', // <-- CORREÇÃO AQUI
    borderWidth: 0,
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '14px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flexGrow: 1,
  },
  deleteBtn: {
    position: 'absolute',
    right: '6px', 
    borderWidth: 0,
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%', 
    color: { 
      default: '#a8c7fa', 
      ':hover': '#f28b82' 
    },
    backgroundColor: { default: 'transparent', ':hover': 'rgba(255,255,255,0.1)' }, // <-- CORREÇÃO AQUI
    transition: 'color 0.2s, background-color 0.2s',
  },
  activeItem: {
    backgroundColor: '#004a77', 
    color: '#c2e7ff',
  },
  // ========================================

  main: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    width: { [MOBILE]: '100%' }, 
    boxSizing: 'border-box',
  },
  header: {
    padding: { default: '16px 24px', [MOBILE]: '12px 16px' },
    fontSize: { default: '22px', [MOBILE]: '18px' },
    fontWeight: 500,
    color: '#e3e3e3',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between', 
    borderBottomWidth: { default: 0, [MOBILE]: '1px' },
    borderBottomStyle: 'solid',
    borderBottomColor: '#333',
  },
  
  iconBtn: {
    background: 'none',
    borderWidth: 0,
    color: '#e3e3e3',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: { default: 'transparent', ':hover': '#333538' },
    transition: 'background-color 0.2s',
  },
  mobileOnly: {
    display: { default: 'none', [MOBILE]: 'flex' },
  },
  sendBtnColor: {
    color: '#c2e7ff',
  },
  iconBtnDisabled: {
    color: '#555',
    cursor: 'not-allowed',
    backgroundColor: 'transparent',
  },

  scrollToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#333',
    backgroundColor: 'transparent',
    color: '#a8c7fa',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  scrollToggleActive: {
    backgroundColor: 'rgba(168, 199, 250, 0.1)',
    borderColor: '#a8c7fa',
  },
  hideOnMobile: {
    display: { default: 'block', [MOBILE]: 'none' },
  },

  badge: {
    fontSize: '12px',
    backgroundColor: '#004a77',
    color: '#c2e7ff',
    padding: '4px 8px',
    borderRadius: '12px',
    fontWeight: 'bold',
  },
  
  chatContainer: {
    flexGrow: 1,
    overflowY: 'auto',
    padding: { default: '24px', [MOBILE]: '16px' },
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    scrollBehavior: 'smooth',
  },
  chatWrapper: {
    width: '100%',
    maxWidth: '800px',
    display: 'flex',
    flexDirection: 'column',
    gap: { default: '24px', [MOBILE]: '16px' },
  },
  messageRow: {
    display: 'flex',
    gap: { default: '16px', [MOBILE]: '10px' },
    alignItems: 'flex-start',
    width: '100%',
  },
  messageRowUser: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: { default: '36px', [MOBILE]: '30px' },
    height: { default: '36px', [MOBILE]: '30px' },
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontWeight: 'bold',
    fontSize: { default: '18px', [MOBILE]: '14px' },
  },
  avatarAi: {
    backgroundColor: '#004a77',
    color: '#c2e7ff',
  },
  avatarUser: {
    backgroundColor: '#333538',
    color: '#fff',
  },
  messageBubble: {
    padding: { default: '12px 16px', [MOBILE]: '10px 14px' },
    borderRadius: '16px',
    fontSize: { default: '16px', [MOBILE]: '15px' },
    lineHeight: '1.5',
    maxWidth: { default: '80%', [MOBILE]: '90%' }, 
  },
  bubbleAi: {
    backgroundColor: '#1e1f20',
    color: '#e3e3e3',
    borderTopLeftRadius: '4px',
  },
  bubbleUser: {
    backgroundColor: '#333538',
    color: '#e3e3e3',
    borderTopRightRadius: '4px',
  },

  inputArea: {
    padding: { default: '16px 24px 24px', [MOBILE]: '12px 16px 16px' },
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: '#131314',
    width: '100%',
    boxSizing: 'border-box',
  },
  tokenInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: { default: '12px', [MOBILE]: '11px' },
    color: '#a8c7fa',
    paddingInline: { default: '16px', [MOBILE]: '8px' },
    opacity: 0.8,
  },
  tokenWarning: {
    color: '#f28b82',
    opacity: 1,
    fontWeight: 'bold',
  },
  inputWrapper: {
    width: '100%',
    boxSizing: 'border-box', 
    backgroundColor: '#1e1f20',
    borderRadius: '24px',
    display: 'flex',
    alignItems: 'center', 
    padding: { default: '8px 16px', [MOBILE]: '6px 12px' },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: { default: 'transparent', ':focus-within': '#444746' },
  },
  inputWrapperDisabled: {
    opacity: 0.6,
    backgroundColor: '#1a1a1a',
  },
  textarea: {
    flexGrow: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: '#e3e3e3',
    fontSize: '16px', 
    lineHeight: '1.5',
    resize: 'none',
    outlineWidth: 0,
    padding: '8px', 
    margin: 0,
    maxHeight: { default: '200px', [MOBILE]: '120px' },
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    display: 'block',
  },
});
