export const getApiBaseUrl = (): string => {
  // 1. Modo de Produção
  // O Vite injeta import.meta.env.PROD como true ao rodar 'vite build'
  if (import.meta.env.PROD) {
    // Se no futuro precisar de múltiplos ambientes (staging, etc), 
    // você pode trocar por import.meta.env.VITE_API_URL, mas 
    // para a regra atual de negócio, fixamos o domínio de prod.
    return 'https://api.zolta';
  }

  // 2. Modo de Desenvolvimento (Local ou Rede)
  const hostname = window.location.hostname;
  const BACKEND_PORT = 3000; // Altere para a porta exposta pelo container do NestJS

  // Quando você acessa do PC: hostname será 'localhost'
  // Quando você acessa do celular: hostname será o IP do seu PC (ex: 192.168.1.50)
  // Como o modo de rede do Docker/WSL está espelhado, o NestJS responderá no mesmo IP.
  return `http://${hostname}:${BACKEND_PORT}`;
};
