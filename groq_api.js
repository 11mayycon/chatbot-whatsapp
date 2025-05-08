const { Groq } = require('groq-sdk');
const config = require('./config');

// Inicializar o cliente Groq
const groq = new Groq({
    apiKey: config.GROQ_API_KEY
});

// Função para enviar mensagem para o modelo LLM
async function obterResposta(mensagem, contexto = '') {
    try {
        // Retornar a mensagem fallback definida no config.js
        return config.MENSAGENS.FALLBACK;
    } catch (erro) {
        console.error('Erro ao processar resposta:', erro);
        return config.MENSAGENS.FALLBACK;
    }
}

// Exportar funções
module.exports = {
    obterResposta
}; 