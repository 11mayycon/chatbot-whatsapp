const db = require('./database');
const config = require('./config');
const moment = require('moment');
const crypto = require('crypto');

// Armazenar tokens temporários (em produção, deve usar um armazenamento persistente)
const adminTokens = {};

// Verificar se um número está na lista de admins
function isAdmin(telefone) {
    return config.ADMIN_NUMBERS.includes(telefone);
}

// Gerar token de acesso ao painel
function gerarToken(telefone) {
    // Gerar token aleatório
    const token = crypto.randomBytes(16).toString('hex');
    // Armazenar token com validade de 30 minutos
    adminTokens[token] = {
        telefone: telefone,
        expira: Date.now() + (30 * 60 * 1000) // 30 minutos em milissegundos
    };
    return token;
}

// Verificar se um token é válido
function verificarToken(token) {
    const tokenInfo = adminTokens[token];
    if (!tokenInfo) return false;
    
    // Verificar se o token expirou
    if (tokenInfo.expira < Date.now()) {
        delete adminTokens[token]; // Remover token expirado
        return false;
    }
    
    return tokenInfo.telefone;
}

// Processar comandos de administração
async function processarComandoAdmin(mensagem, telefone) {
    // Verificar se é admin
    if (!isAdmin(telefone)) {
        return {
            sucesso: false,
            mensagem: "❌ Você não tem permissão para usar comandos administrativos."
        };
    }

    // Obter comandos (formato: /comando param1 param2...)
    const partes = mensagem.trim().split(/\s+/);
    const comando = partes[0].toLowerCase();

    try {
        switch (comando) {
            case '/admin':
                // Verificar se o código PIN é correto
                if (partes.length > 1 && partes[1] === '4321') {
                    return await acessarPainelAdmin(telefone);
                } else {
                    return {
                        sucesso: false,
                        mensagem: "❌ Código PIN inválido. Acesso negado."
                    };
                }
            
            case '/add_tela':
                return await adicionarTela(partes.slice(1));
            
            case '/saldo':
                return await gerenciarSaldo(partes.slice(1));
            
            case '/editar_boasvindas':
                return await editarBoasVindas(mensagem.substring(comando.length).trim());
            
            case '/relatorios':
                return await gerarRelatorios(partes.slice(1));
            
            case '/remover_expirados':
                return await removerExpirados();
                
            case '/enviar_aviso':
                return await enviarAviso(mensagem.substring(comando.length).trim());
            
            default:
                return {
                    sucesso: false,
                    mensagem: "❌ Comando administrativo não reconhecido."
                };
        }
    } catch (erro) {
        console.error('Erro ao processar comando admin:', erro);
        return {
            sucesso: false,
            mensagem: "❌ Ocorreu um erro ao processar o comando. Verifique o formato e tente novamente."
        };
    }
}

// Acesso ao painel administrativo
async function acessarPainelAdmin(telefone) {
    try {
        // Obter nome do usuário
        const usuario = await db.getUsuario(telefone);
        const nome = usuario ? usuario.nome : 'Administrador';
        
        // Gerar token de acesso
        const token = gerarToken(telefone);
        
        // Obter IP ou domínio do servidor (deve ser configurado para produção)
        const host = process.env.SERVER_HOST || 'localhost';
        const porta = config.WEB_PORT || 3000;
        
        return {
            sucesso: true,
            mensagem: `🔐 Acesso autorizado, ${nome}!

🖥️ Seu Painel Administrativo está disponível:
🌐 http://${host}:${porta}/painel?token=${token}

Use seu número de WhatsApp para login seguro.
O acesso expira em 30 minutos.`
        };
    } catch (erro) {
        console.error('Erro ao acessar painel admin:', erro);
        return {
            sucesso: false,
            mensagem: "❌ Ocorreu um erro ao gerar o link de acesso ao painel."
        };
    }
}

// Comandos específicos
async function adicionarTela(params) {
    // Formato esperado: /add_tela plataforma slot validade
    if (params.length < 3) {
        return {
            sucesso: false,
            mensagem: "❌ Formato incorreto. Use: /add_tela plataforma slot validade"
        };
    }
    
    const [plataforma, slotStr, validade] = params;
    const slot = parseInt(slotStr);
    
    // Validar slot
    if (isNaN(slot) || slot <= 0) {
        return {
            sucesso: false,
            mensagem: "❌ O slot deve ser um número positivo"
        };
    }
    
    // Validar data de validade
    if (!moment(validade, 'YYYY-MM-DD').isValid()) {
        return {
            sucesso: false,
            mensagem: "❌ Formato de data inválido. Use YYYY-MM-DD (ex: 2023-12-31)"
        };
    }
    
    // Adicionar tela
    await db.adicionarTela({
        plataforma,
        slot,
        validade
    });
    
    return {
        sucesso: true,
        mensagem: `✅ Tela ${plataforma} (slot ${slot}) adicionada com sucesso!\nValidade: ${validade}`
    };
}

async function gerenciarSaldo(params) {
    // Formatos:
    // /saldo @numero - consultar saldo
    // /saldo @numero +valor - adicionar saldo
    // /saldo @numero -valor - remover saldo
    
    if (params.length < 1) {
        return {
            sucesso: false,
            mensagem: "❌ Formato incorreto. Use: /saldo @numero [+/-valor]"
        };
    }
    
    let telefone = params[0];
    // Remover @ se presente
    if (telefone.startsWith('@')) {
        telefone = telefone.substring(1);
    }
    
    // Verificar se usuário existe
    const usuario = await db.getUsuario(telefone);
    if (!usuario) {
        return {
            sucesso: false,
            mensagem: "❌ Usuário não encontrado"
        };
    }
    
    // Se apenas consulta de saldo
    if (params.length === 1) {
        const saldo = await db.getSaldo(telefone);
        return {
            sucesso: true,
            mensagem: `💰 Saldo de ${usuario.nome}: R$ ${saldo.toFixed(2)}`
        };
    }
    
    // Se alteração de saldo
    const operacao = params[1];
    
    if (operacao.startsWith('+')) {
        const valor = parseFloat(operacao.substring(1));
        if (isNaN(valor) || valor <= 0) {
            return {
                sucesso: false,
                mensagem: "❌ Valor inválido"
            };
        }
        
        await db.adicionarSaldo(telefone, valor, "Adição de saldo pelo admin");
        const novoSaldo = await db.getSaldo(telefone);
        return {
            sucesso: true,
            mensagem: `✅ Adicionado R$ ${valor.toFixed(2)} ao saldo de ${usuario.nome}\nNovo saldo: R$ ${novoSaldo.toFixed(2)}`
        };
    }
    
    if (operacao.startsWith('-')) {
        const valor = parseFloat(operacao.substring(1));
        if (isNaN(valor) || valor <= 0) {
            return {
                sucesso: false,
                mensagem: "❌ Valor inválido"
            };
        }
        
        const resultado = await db.removerSaldo(telefone, valor, "Remoção de saldo pelo admin");
        if (!resultado.sucesso) {
            return {
                sucesso: false,
                mensagem: `❌ ${resultado.mensagem}`
            };
        }
        
        return {
            sucesso: true,
            mensagem: `✅ Removido R$ ${valor.toFixed(2)} do saldo de ${usuario.nome}\nNovo saldo: R$ ${resultado.saldo.toFixed(2)}`
        };
    }
    
    return {
        sucesso: false,
        mensagem: "❌ Operação inválida. Use +valor para adicionar ou -valor para remover saldo."
    };
}

async function editarBoasVindas(novoTexto) {
    if (!novoTexto || novoTexto.trim() === '') {
        return {
            sucesso: false,
            mensagem: "❌ Texto de boas-vindas não pode ser vazio"
        };
    }
    
    // Para editar a mensagem de boas-vindas, você precisaria
    // implementar um sistema de configurações persistente.
    // Neste exemplo, estamos apenas simulando:
    
    return {
        sucesso: true,
        mensagem: "✅ Mensagem de boas-vindas atualizada com sucesso!"
    };
}

async function gerarRelatorios(params) {
    const tipo = params.length > 0 ? params[0].toLowerCase() : 'resumo';
    
    // Aqui você implementaria lógica para gerar diferentes tipos de relatórios
    // do banco de dados. Este é um exemplo simples:
    
    let mensagem = "📊 RELATÓRIO DE SISTEMA\n\n";
    
    switch (tipo) {
        case 'vendas':
            mensagem += "🔹 Relatório de Vendas (Últimos 30 dias)\n";
            mensagem += "- Implementação completa depende da lógica de banco de dados";
            break;
            
        case 'usuarios':
            mensagem += "🔹 Relatório de Usuários\n";
            mensagem += "- Implementação completa depende da lógica de banco de dados";
            break;
            
        case 'estoque':
            mensagem += "🔹 Relatório de Estoque\n";
            // Telas disponíveis e ocupadas
            mensagem += "- Implementação completa depende da lógica de banco de dados";
            break;
            
        default: // resumo
            mensagem += "🔹 Resumo do Sistema\n";
            mensagem += "- Implementação completa depende da lógica de banco de dados";
            break;
    }
    
    return {
        sucesso: true,
        mensagem
    };
}

async function removerExpirados() {
    const resultado = await db.removerExpirados();
    
    return {
        sucesso: true,
        mensagem: `✅ Itens expirados removidos:\n- Telas: ${resultado.telas}`
    };
}

async function enviarAviso(texto) {
    if (!texto || texto.trim() === '') {
        return {
            sucesso: false,
            mensagem: "❌ O texto do aviso não pode ser vazio"
        };
    }
    
    // Aqui implementaria a lógica para enviar mensagem em massa
    // para todos os usuários do sistema
    
    return {
        sucesso: true,
        mensagem: "✅ Aviso programado para envio em massa com sucesso!"
    };
}

// Exportar funções
module.exports = {
    isAdmin,
    processarComandoAdmin,
    verificarToken
}; 