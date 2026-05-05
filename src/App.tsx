import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { getApiBaseUrl } from './config/api';

// Limite do Gemma 4
const MAX_TOKENS = 256000; 

const MOBILE = '@media (max-width: 768px)';

const apiUrl = `${getApiBaseUrl()}`;

export default function App() {
  const [prompt, setPrompt] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isStateless, setIsStateless] = useState(false);
  const [statelessLocked, setStatelessLocked] = useState(false);

  const [chat, setChat] = useState([
    { role: 'ai', text: 'Olá! Sou seu assistente local (Gemma 4). Como posso ajudar?' },
  ]);

  const startNewChat = () => {
    setIsStateless(false);
    setStatelessLocked(false);
    setPrompt('');
    setChat([{ role: 'ai', text: 'Olá! Sou seu assistente local (Gemma 4). Como posso ajudar?' }]);
    setIsSidebarOpen(false);
  };

  const startStatelessChat = () => {
    setIsStateless(true);
    setStatelessLocked(false);
    setPrompt('');
    setChat([{ role: 'ai', text: 'Modo Stateless ativo ⚡\nFaça uma pergunta única. O contexto não será salvo para a próxima interação.' }]);
    setIsSidebarOpen(false);
  };

  const handleSend = async () => {
    if (!prompt.trim() || isLoading || isStreaming || statelessLocked) return;

    const userText = prompt;
    setPrompt(''); 
    
    setChat((prev) => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const validHistory = chat.filter(
        c => c.role === 'user' || (c.role === 'ai' && !c.text.includes('Olá! Sou seu') && !c.text.includes('Modo Stateless'))
      );

      let finalPrompt = userText;
      
      if (!isStateless && validHistory.length > 0) {
        const historyText = validHistory
          .map((msg) => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.text}`)
          .join('\n');
        
        finalPrompt = `${historyText}\nUser: ${userText}\nAI:`;
      }

      // ==== MODO STATELESS ====
      if (isStateless) {
        const response = await fetch(`${apiUrl}/ollama/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemma4',
            prompt: finalPrompt,
            history: [] 
          }),
        });

        if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);

        const responseJson = await response.json();
        const aiResponseText = responseJson.data?.response || responseJson.response || "Resposta recebida";

        setChat((prev) => [...prev, { role: 'ai', text: aiResponseText }]);
        setStatelessLocked(true);
      } 
      
      // ==== MODO STREAMING (NORMAL) ====
      else {
        const response = await fetch(`${apiUrl}/ollama/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemma4',
            prompt: finalPrompt,
            history: validHistory 
          }),
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

            // Ignora linhas vazias ou metadados de SSE como "id: 1" ou "event: message"
            if (!trimmedLine || trimmedLine.startsWith('id:') || trimmedLine.startsWith('event:')) {
              continue;
            }

            // Captura apenas o que vem depois de "data: "
            if (trimmedLine.startsWith('data:')) {
              // Remove o prefixo "data:" e limpa espaços
              const jsonString = trimmedLine.replace(/^data:/, '').trim();

              if (jsonString === '[DONE]') continue; // Tratamento de fechamento comum em SSE

              try {
                const parsed = JSON.parse(jsonString);
                
                // Baseado no seu log, o texto vem em parsed.data
                const textChunk = parsed.data ?? parsed.response ?? parsed.message?.content ?? '';

                if (textChunk) {
                  if (isFirstChunk) {
                    setIsLoading(false);
                    setIsStreaming(true);
                    setChat((prev) => [...prev, { role: 'ai', text: textChunk }]);
                    isFirstChunk = false;
                  } else {
                    setChat((prev) => {
                      const newChat = [...prev];
                      const lastIndex = newChat.length - 1;
                      newChat[lastIndex] = {
                        ...newChat[lastIndex],
                        text: newChat[lastIndex].text + textChunk
                      };
                      return newChat;
                    });
                  }
                }
              } catch (e) {
                // Se der erro no parse de um chunk, ignora silenciosamente para não sujar a tela
                console.warn("Ignorando chunk inválido:", jsonString);
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Erro ao chamar o NestJS:', error);
      setChat((prev) => [
        ...prev, 
        { role: 'ai', text: 'Desculpe, ocorreu um erro ao se comunicar com o servidor local.' }
      ]);
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
          {...stylex.props(s.chatItem, isStateless && s.activeItem)} 
          onClick={startStatelessChat}
          style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span style={{ fontSize: '18px' }}>⚡</span>
          Modo Stateless
        </button>
        
        <div {...stylex.props(s.historyTitle)}>Recentes</div>
        <button {...stylex.props(s.chatItem)}>Exemplo de histórico...</button>
      </aside>

      <main {...stylex.props(s.main)}>
        <header {...stylex.props(s.header)}>
          <button 
            {...stylex.props(s.menuButton)} 
            onClick={() => setIsSidebarOpen(true)}
            title="Abrir menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>
          
          <span>Gemma 4 Local</span>
          {isStateless && <span {...stylex.props(s.badge)}>Stateless</span>}
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
                {...stylex.props(s.sendButton, isInputDisabled && s.sendButtonDisabled)} 
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
    borderRadius: '24px',
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
    paddingInline: '12px',
  },
  chatItem: {
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    backgroundColor: { default: 'transparent', ':hover': '#333538' },
    color: '#e3e3e3',
    borderWidth: 0,
    textAlign: 'left',
  },
  activeItem: {
    backgroundColor: '#333538',
    color: '#c2e7ff',
  },

  main: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    width: { [MOBILE]: '100%' }, 
  },
  header: {
    padding: { default: '16px 24px', [MOBILE]: '12px 16px' },
    fontSize: { default: '22px', [MOBILE]: '18px' },
    fontWeight: 500,
    color: '#e3e3e3',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottomWidth: { default: 0, [MOBILE]: '1px' },
    borderBottomStyle: 'solid',
    borderBottomColor: '#333',
  },
  menuButton: {
    display: { default: 'none', [MOBILE]: 'flex' },
    background: 'none',
    borderWidth: 0,
    color: '#e3e3e3',
    cursor: 'pointer',
    padding: '4px',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#1e1f20',
    borderRadius: '24px',
    display: 'flex',
    alignItems: 'flex-end',
    padding: { default: '12px 16px', [MOBILE]: '8px 12px' },
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
    padding: '0 8px',
    maxHeight: { default: '200px', [MOBILE]: '120px' },
    fontFamily: 'inherit',
  },
  sendButton: {
    background: 'none',
    borderWidth: 0,
    color: '#c2e7ff',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: { default: 'transparent', ':hover': '#333538' },
  },
  sendButtonDisabled: {
    color: '#555',
    cursor: 'not-allowed',
    backgroundColor: 'transparent',
  },
});
