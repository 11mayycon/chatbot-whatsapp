// Configurações do Bot de WhatsApp

module.exports = {
    // API Key do Groq
    GROQ_API_KEY: "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",
    
    // Lista de números de administradores (formato: 55XXXXXXXXXXX)
    ADMIN_NUMBERS: [
        "5511999999999", // Substitua pelo número real do administrador
        "5511978197645"  // Número do Maicon Correia (criador)
    ],
    
    // Configurações do servidor web (opcional)
    WEB_PORT: 3002,
    SERVER_HOST: process.env.SERVER_HOST || 'localhost',
    
    // Configurações do banco de dados
    DATABASE_FILE: "./database.db",
    
    // Mensagens padrão
    MENSAGENS: {
        BOAS_VINDAS: `🎖 Olá [NOME], seja bem-vindo(a) ao melhor Store de Streaming!  
Aqui seu 💰 vale mais!

🍔 IFOOD STORE  
🎮 SENTIU VONTADE? PEDE UM STREAMING! 📺

🔥 Há mais de 1 ano, o *Ifood das Contas* se destaca como o líder em:
✔️ Streamings  
✔️ Jogos online  
✔️ Assinaturas premium

💎 Oferecemos a você uma experiência:
✅ ÚNICA  
✅ CONFIÁVEL  
✅ DE ALTA QUALIDADE

📦 Tudo isso com o melhor custo-benefício do mercado!  
Aproveite agora e economize no seu entretenimento! 🎉

⚠️ Leia com atenção antes de comprar!  
🔍 Confira a disponibilidade do produto!  
🚫 Não realizamos reembolsos!

💰 Seu saldo atual: R$ [SALDO]`,

        MENU_PRINCIPAL: `Escolha uma opção:

💸 Fazer Recarga
- Adicione saldo à sua conta para comprar streamings e assinaturas.

🎬 Telas Streaming
- Veja as opções disponíveis de streaming com o melhor custo-benefício.

ℹ️ Informações
- Saiba como funciona, regras, prazos de entrega e perguntas frequentes.

👨‍💻 Suporte
- Fale com nosso atendimento humano em caso de dúvidas ou problemas.

🚀 Criador
- Conheça quem desenvolveu esse bot e como entrar em contato.

🆘 Ajuda / Comandos
- Manual completo para aprender a usar o bot.`,

        ERRO: `⚠️ Ocorreu um erro no processamento. Tente novamente.`,
        
        FALLBACK: `🤖 Para ajuda, digite \`ajuda\`  
Para ver o menu, digite \`menu\``,

        CRIADOR: `🤖 Bot desenvolvido por Maicon Correia, CEO da Inovapro 💼  
✉️ Contato: +5511978197645`
    }
}; 