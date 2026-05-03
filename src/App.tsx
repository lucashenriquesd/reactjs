import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Novos estados para o controle Stateless
  const [isStateless, setIsStateless] = useState(false);
  const [statelessLocked, setStatelessLocked] = useState(false);

  const [chat, setChat] = useState([
    { role: 'ai', text: 'Olá! Sou seu assistente local. Como posso ajudar?' },
  ]);

  const startNewChat = () => {
    setIsStateless(false);
    setStatelessLocked(false);
    setPrompt('');
    setChat([{ role: 'ai', text: 'Olá! Sou seu assistente local. Como posso ajudar?' }]);
  };

  const startStatelessChat = () => {
    setIsStateless(true);
    setStatelessLocked(false);
    setPrompt('');
    setChat([{ role: 'ai', text: 'Modo Stateless ativo ⚡\nFaça uma pergunta única. O contexto não será salvo para a próxima interação.' }]);
  };

  const handleSend = async () => {
    if (!prompt.trim() || isLoading || statelessLocked) return;

    const userText = prompt;
    setPrompt(''); 
    
    setChat((prev) => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/ollama/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemma4',
          prompt: userText,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.statusText}`);
      }

      const responseJson = await response.json();
      const aiResponseText = responseJson.data?.response || responseJson.response || "Resposta recebida";

      setChat((prev) => [...prev, { role: 'ai', text: aiResponseText }]);

      // Bloqueia o chat se estiver no modo stateless após o sucesso da resposta
      if (isStateless) {
        setStatelessLocked(true);
      }

    } catch (error) {
      console.error('Erro ao chamar o NestJS:', error);
      setChat((prev) => [
        ...prev, 
        { role: 'ai', text: 'Desculpe, ocorreu um erro ao se comunicar com o servidor local.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Trava o input se estiver carregando OU se a conversa stateless já foi concluída
  const isInputDisabled = isLoading || statelessLocked;

  return (
    <div {...stylex.props(s.layout)}>
      <aside {...stylex.props(s.sidebar)}>
        <button {...stylex.props(s.newChatBtn)} onClick={startNewChat}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Novo chat normal
        </button>

        {/* Botão de fixar o modo Stateless no menu */}
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
          Gemini Clone (NestJS)
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
          <div {...stylex.props(s.inputWrapper, isInputDisabled && s.inputWrapperDisabled)}>
            <textarea
              {...stylex.props(s.textarea)}
              rows={1}
              placeholder={
                statelessLocked 
                  ? "Modo Stateless concluído. Inicie um novo chat." 
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
  
  // --- BARRA LATERAL (SIDEBAR) ---
  sidebar: {
    width: '280px',
    backgroundColor: '#1e1f20',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    boxSizing: 'border-box',
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: '#333',
    flexShrink: 0,
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

  // --- ÁREA PRINCIPAL ---
  main: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  header: {
    padding: '16px 24px',
    fontSize: '22px',
    fontWeight: 500,
    color: '#e3e3e3',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  badge: {
    fontSize: '12px',
    backgroundColor: '#004a77',
    color: '#c2e7ff',
    padding: '4px 8px',
    borderRadius: '12px',
    fontWeight: 'bold',
  },
  
  // --- HISTÓRICO DA CONVERSA ---
  chatContainer: {
    flexGrow: 1,
    overflowY: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  chatWrapper: {
    width: '100%',
    maxWidth: '800px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  messageRow: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
    width: '100%',
  },
  messageRowUser: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontWeight: 'bold',
    fontSize: '18px',
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
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '16px',
    lineHeight: '1.5',
    maxWidth: '80%',
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

  // --- ÁREA DE INPUT ---
  inputArea: {
    padding: '16px 24px 24px',
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: '#131314',
  },
  inputWrapper: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: '#1e1f20',
    borderRadius: '24px',
    display: 'flex',
    alignItems: 'flex-end',
    padding: '12px 16px',
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
    maxHeight: '200px',
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
