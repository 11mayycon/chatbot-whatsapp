const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const db = require('./database');
const groq = require('./groq_api');
const admin = require('./admin');
const config = require('./config');

// Inicializar o cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Manipulador de eventos
client.on('qr', (qr) => {
    console.log('QR Code recebido, escaneie com seu WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot Ifood Das Contas e Streamings conectado e pronto!');
});

client.on('authenticated', () => {
    console.log('Autenticação bem-sucedida!');
});

client.on('auth_failure', (msg) => {
    console.error('Falha na autenticação:', msg);
});

// Manipulador de mensagens recebidas
client.on('message', async (msg) => {
    try {
        // Ignorar mensagens de grupos
        if (msg.isGroupMsg) return;
        
        // Obter número do remetente (formato: XXXXXXXXXXXX)
        const telefone = msg.from.replace(/\D/g, '');
        
        // Verificar se é um comando de admin
        if (msg.body.startsWith('/') && admin.isAdmin(telefone)) {
            const resposta = await admin.processarComandoAdmin(msg.body, telefone);
            await enviarMensagemSegura(msg, resposta.mensagem);
            return;
        }
        
        // Obter contato
        const contato = await msg.getContact();
        const nome = contato.pushname || 'Cliente';
        
        // Verificar se usuário está cadastrado
        let usuario = await db.getUsuario(telefone);
        let isNovoUsuario = false;
        
        if (!usuario) {
            // Novo usuário - Cadastrar
            await db.cadastrarUsuario(telefone, nome);
            usuario = { telefone, nome, saldo: 0 };
            isNovoUsuario = true;
        }
        
        // Verificar se é um comprovante (imagem)
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            
            // Verificar se é imagem 
            if (media.mimetype.startsWith('image/')) {
                // Informar recebimento do comprovante
                await enviarMensagemSegura(msg, `✅ *COMPROVANTE RECEBIDO*

Seu comprovante foi recebido com sucesso. 
Por favor, aguarde enquanto processamos seu pagamento.`);
                
                // Processar o comprovante imediatamente
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const axios = require('axios');
                    const FormData = require('form-data');
                    
                    // Criar diretório de uploads se não existir
                    const uploadDir = path.join(__dirname, 'uploads');
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }
                    
                    // Gerar nome de arquivo único
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                    const mimeParts = media.mimetype.split('/');
                    const ext = mimeParts[1] || 'jpg';
                    const filename = `comprovante-${telefone}-${uniqueSuffix}.${ext}`;
                    const filepath = path.join(uploadDir, filename);
                    
                    // Salvar o arquivo
                    fs.writeFileSync(filepath, Buffer.from(media.data, 'base64'));
                    
                    // Enviar para a API do painel usando FormData
                    const formData = new FormData();
                    formData.append('telefone', telefone);
                    formData.append('valor', 0); // Valor temporário, será definido pelo administrador
                    formData.append('comprovante', fs.createReadStream(filepath));
                    
                    // Enviar para a API
                    const response = await axios.post(
                        `http://localhost:${config.WEB_PORT || 3001}/api/upload-comprovante`,
                        formData,
                        {
                            headers: {
                                ...formData.getHeaders(),
                            },
                        }
                    );
                    
                    if (!response.data || !response.data.sucesso) {
                        throw new Error('Erro na resposta da API');
                    }
                    
                } catch (erro) {
                    console.error('Erro ao processar comprovante:', erro);
                    await enviarMensagemSegura(msg, "❌ Ocorreu um erro ao processar seu comprovante. Por favor, tente novamente mais tarde ou contate o suporte.");
                }
                
                return;
            }
        }
        
        // Verificar se deve enviar mensagem de boas-vindas
        // Envia apenas para usuários novos ou inativos por mais de 24h
        const deveEnviarBoasVindas = isNovoUsuario || !usuario.ultima_interacao || isInativoPor24h(usuario.ultima_interacao);
        
        // Atualizar interação do usuário
        await db.atualizarInteracao(telefone);
        
        // Enviar boas-vindas somente se for necessário
        if (deveEnviarBoasVindas) {
            const saldo = await db.getSaldo(telefone);
            
            const boasVindas = config.MENSAGENS.BOAS_VINDAS
                .replace('[NOME]', nome)
                .replace('[SALDO]', saldo.toFixed(2));
                
            await enviarMensagemSegura(msg, boasVindas);
            
            // Não mostrar o menu principal automaticamente
            return;
        }
        
        // Processar mensagem do usuário (para todos os usuários)
        await processarMensagem(msg, telefone, nome);
        
    } catch (erro) {
        console.error('Erro ao processar mensagem:', erro);
        await enviarMensagemSegura(msg, config.MENSAGENS.ERRO);
    }
});

// Função para verificar se usuário está inativo por mais de 24h
function isInativoPor24h(ultimaInteracao) {
    if (!ultimaInteracao) return true;
    
    // Converter string de data para objeto Date se necessário
    const dataUltimaInteracao = typeof ultimaInteracao === 'string' 
        ? new Date(ultimaInteracao) 
        : ultimaInteracao;
    
    const agora = new Date();
    const umDiaEmMs = 24 * 60 * 60 * 1000; // 24 horas em milissegundos
    
    return (agora - dataUltimaInteracao) > umDiaEmMs;
}

// Iniciar o cliente
client.initialize();

// Inicializar o painel administrativo
const painel = require('./painel');
painel.iniciar();

// Funções auxiliares
async function processarMensagem(msg, telefone, nome) {
    const mensagem = msg.body.trim().toLowerCase();
    const saldo = await db.getSaldo(telefone);
    
    // Verificar se a mensagem faz parte da mensagem de boas-vindas
    const boasVindasTexto = config.MENSAGENS.BOAS_VINDAS
        .replace('[NOME]', '')
        .replace('[SALDO]', '0.00')
        .toLowerCase();
    
    const linhasBoasVindas = boasVindasTexto.split('\n');
    
    // Se a mensagem for uma linha da mensagem de boas-vindas, não responder
    for (const linha of linhasBoasVindas) {
        const linhaLimpa = linha.trim();
        if (linhaLimpa && mensagem.includes(linhaLimpa)) {
            return; // Não responde a mensagens que são partes da mensagem de boas-vindas
        }
    }
    
    // Comandos de menu principal
    switch (mensagem) {
        case 'menu':
            await enviarMenuPrincipal(msg);
            break;
            
        case '💸 fazer recarga':
        case 'fazer recarga':
        case 'recarga':
            await enviarMenuRecarga(msg);
            break;
            
        case '🎬 telas streaming':
        case 'telas streaming':
        case 'telas':
            await enviarMenuTelas(msg, telefone);
            break;
            
        case 'ℹ️ informações':
        case 'informações':
        case 'info':
            await enviarInformacoes(msg);
            break;
            
        case '👨‍💻 suporte':
        case 'suporte':
            await enviarSuporte(msg);
            break;
            
        case '🚀 criador':
        case 'criador':
            await enviarCriador(msg);
            break;
            
        case '🆘 ajuda / comandos':
        case 'ajuda / comandos':
        case 'ajuda':
        case 'comandos':
            await enviarAjuda(msg);
            break;
            
        case 'saldo':
            await enviarMensagemSegura(msg, `💰 Seu saldo atual é: R$ ${saldo.toFixed(2)}`);
            break;
            
        default:
            // Verificar se é uma compra de tela
            if (mensagem.startsWith('comprar tela ')) {
                const idTela = parseInt(mensagem.replace('comprar tela ', ''));
                await processarComprarTela(msg, telefone, idTela);
                return;
            }
            
            // Enviar mensagem de fallback (não entendi)
            await enviarMensagemSegura(msg, config.MENSAGENS.FALLBACK);
            break;
    }
}

async function enviarMenuPrincipal(msg) {
    await enviarMensagemSegura(msg, config.MENSAGENS.MENU_PRINCIPAL);
}

async function enviarMenuRecarga(msg) {
    const resposta = `💰 Para adicionar saldo, realize um PIX com o valor desejado para a chave:

🔑 Chave PIX: ifooddascontas@pix.com.br  
🏦 Nome: Ifood das Contas Store  
📝 Envie o comprovante aqui no chat após o pagamento para validarmos sua recarga.

⏳ A confirmação pode levar até 10 minutos.`;

    await enviarMensagemSegura(msg, resposta);
}

// Função para enviar menu de ajuda/comandos
async function enviarAjuda(msg) {
    const resposta = `📘 Manual de Uso - Ifood das Contas

🔹 Digite \`menu\` para ver todas as opções disponíveis.

🔹 Digite \`ajuda\` para abrir este manual novamente.

🔹 Para fazer uma compra, vá até "🎬 Telas Streaming" e escolha o serviço.

🔹 Para recarregar saldo, vá em "💸 Fazer Recarga" e siga as instruções.

🔹 Em caso de dúvidas ou problemas, clique em "👨‍💻 Suporte".`;

    await enviarMensagemSegura(msg, resposta);
}

async function enviarMenuTelas(msg, telefone) {
    // Obter telas disponíveis
    const telas = await db.getTelasDisponiveis();
    
    if (telas.length === 0) {
        await enviarMensagemSegura(msg, "❌ Não há telas de streaming disponíveis no momento. Por favor, tente novamente mais tarde.");
        return;
    }
    
    // Agrupar por plataforma
    const plataformas = {};
    telas.forEach(tela => {
        if (!plataformas[tela.plataforma]) {
            plataformas[tela.plataforma] = [];
        }
        plataformas[tela.plataforma].push(tela);
    });
    
    // Construir resposta
    let resposta = `📺 *TELAS DE STREAMING DISPONÍVEIS*\n\n`;
    resposta += `Para comprar, envie: *comprar tela ID*\n\n`;
    
    for (const [plataforma, telasPlataforma] of Object.entries(plataformas)) {
        resposta += `*${plataforma.toUpperCase()}*\n`;
        
        telasPlataforma.forEach(tela => {
            resposta += `ID: ${tela.id} - Slot: ${tela.slot} - Preço: R$ 22,00\n`;
        });
        
        resposta += `\n`;
    }
    
    const saldo = await db.getSaldo(telefone);
    resposta += `💰 Seu saldo: R$ ${saldo.toFixed(2)}\n`;
    resposta += `⚠️ Confira a disponibilidade antes de comprar!`;
    
    await enviarMensagemSegura(msg, resposta);
}

async function enviarInformacoes(msg) {
    const resposta = `ℹ️ *INFORMAÇÕES DO SERVIÇO*

🔹 *Telas de Streaming*
- Compartilhe com a família
- Streaming HD/4K (conforme plataforma)
- 30 dias de garantia
- Preço: R$ 22,00

⚠️ *Termos de Uso*
- Não compartilhe suas credenciais
- Use apenas nos dispositivos permitidos
- Não altere senhas das contas
- Sem reembolsos após a compra

📞 *Horário de Atendimento*
Segunda a Sexta: 09h às 18h
Sábado: 10h às 14h`;

    await enviarMensagemSegura(msg, resposta);
}

async function enviarSuporte(msg) {
    const resposta = `👨‍💻 *SUPORTE TÉCNICO*

Caso esteja com problemas em sua tela, siga estes passos:

1️⃣ Verifique sua internet
2️⃣ Tente sair e entrar novamente
3️⃣ Limpe o cache do aplicativo

Se o problema persistir, descreva o que está acontecendo com detalhes, incluindo:
- Plataforma (Netflix, Prime, etc)
- Dispositivo (Smart TV, Celular, PC)
- Mensagem de erro (se houver)

Um administrador irá analisar seu caso o mais breve possível.

⏱️ Tempo médio de resposta: 2 horas`;

    await enviarMensagemSegura(msg, resposta);
}

async function enviarCriador(msg) {
    const resposta = `🤖 Bot desenvolvido por Maicon Correia, CEO da Inovapro💼  
✉️ Contato: +5511978197645`;

    await enviarMensagemSegura(msg, resposta);
}

async function processarComprarTela(msg, telefone, idTela) {
    // Verificar se a tela existe
    const tela = await db.getDetalheTela(idTela);
    if (!tela || tela.status !== 'disponível') {
        await enviarMensagemSegura(msg, "❌ Esta tela não está disponível para compra.");
        return;
    }
    
    // Verificar saldo
    const saldo = await db.getSaldo(telefone);
    const preco = 22.00; // Preço fixo para telas
    
    if (saldo < preco) {
        await enviarMensagemSegura(msg, `❌ Saldo insuficiente. Você precisa de R$ ${preco.toFixed(2)} para comprar esta tela, mas possui apenas R$ ${saldo.toFixed(2)}.`);
        return;
    }
    
    // Processar compra
    const resultadoDebito = await db.removerSaldo(telefone, preco, `Compra de tela ${tela.plataforma}`);
    if (!resultadoDebito.sucesso) {
        await enviarMensagemSegura(msg, `❌ Erro ao processar compra: ${resultadoDebito.mensagem}`);
        return;
    }
    
    // Marcar tela como vendida
    const resultadoVenda = await db.venderTela(idTela, telefone);
    if (!resultadoVenda.sucesso) {
        // Devolver saldo em caso de erro
        await db.adicionarSaldo(telefone, preco, "Estorno - Erro ao vender tela");
        await enviarMensagemSegura(msg, `❌ Erro ao processar compra: ${resultadoVenda.mensagem}`);
        return;
    }
    
    // Enviar detalhes da compra
    const resposta = `✅ *COMPRA REALIZADA COM SUCESSO*

📺 *Tela de Streaming ${tela.plataforma}*

📧 *E-mail*: usuario${tela.slot}@streaming.com
🔑 *Senha*: senha${tela.slot}
🔢 *PIN*: ${Math.floor(1000 + Math.random() * 9000)}
📅 *Validade*: ${tela.validade}

⚠️ *IMPORTANTE*:
- Use apenas 1 dispositivo por vez
- Não altere configurações da conta
- Não utilize download de conteúdo

💰 Seu saldo atual: R$ ${resultadoDebito.saldo.toFixed(2)}

Obrigado pela compra!`;

    await enviarMensagemSegura(msg, resposta);
}

// Tratamento de erros não capturados
process.on('uncaughtException', (erro) => {
    console.error('Erro não tratado:', erro);
});

process.on('unhandledRejection', (erro) => {
    console.error('Promessa rejeitada não tratada:', erro);
});

// Exportar a instância do cliente para uso em outros módulos
function getClient() {
    return client;
}

// Função segura para enviar mensagens (com tratamento de erro para "quoted message")
async function enviarMensagemSegura(msg, texto) {
    try {
        // Tentar responder à mensagem original
        return await msg.reply(texto);
    } catch (erro) {
        // Se ocorrer erro, enviar como mensagem normal sem "reply"
        if (erro.message && erro.message.includes("Could not get the quoted message")) {
            console.log("Usando método alternativo de envio devido a erro de quoted message");
            return await client.sendMessage(msg.from, texto);
        }
        // Se for outro erro, repassar
        throw erro;
    }
}

module.exports = {
    getClient,
    enviarMensagemSegura
}; 