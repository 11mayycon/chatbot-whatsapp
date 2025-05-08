const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const admin = require('./admin');
const config = require('./config');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const fs = require('fs');

// Criar aplicação Express
const app = express();
const PORT = config.WEB_PORT || 3001;

// Configurar middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Configurar upload de arquivos
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const comprovanteStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'comprovante-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: comprovanteStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: function (req, file, cb) {
        // Aceitar apenas imagens
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas!'));
        }
    }
});

// Middleware de autenticação simples
function autenticarAdmin(req, res, next) {
    // Verificar se há token na query
    const { token } = req.query;
    
    if (token) {
        // Verificar se o token é válido
        const telefone = admin.verificarToken(token);
        if (telefone) {
            // Token válido, continuar
            req.adminTelefone = telefone;
            return next();
        }
    }
    
    // Verificar se há telefone na query
    const { telefone } = req.query;
    
    // Se não há token ou o token é inválido, verificar o telefone
    if (!telefone || !admin.isAdmin(telefone)) {
        return res.status(401).json({ erro: 'Acesso não autorizado' });
    }
    
    req.adminTelefone = telefone;
    next();
}

// Rota para o painel administrativo com verificação de token
app.get('/painel', (req, res) => {
    const { token } = req.query;
    
    if (!token) {
        return res.status(401).send(`
            <html>
                <head>
                    <title>Acesso Negado</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .error { color: red; }
                    </style>
                </head>
                <body>
                    <h1 class="error">Acesso Negado</h1>
                    <p>Você precisa de um token válido para acessar o painel administrativo.</p>
                    <p>Use o comando <strong>/admin 4321</strong> no WhatsApp para gerar um novo token.</p>
                </body>
            </html>
        `);
    }
    
    const telefone = admin.verificarToken(token);
    if (!telefone) {
        return res.status(401).send(`
            <html>
                <head>
                    <title>Token Expirado</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .error { color: red; }
                    </style>
                </head>
                <body>
                    <h1 class="error">Token Expirado ou Inválido</h1>
                    <p>O token fornecido expirou ou é inválido.</p>
                    <p>Use o comando <strong>/admin 4321</strong> no WhatsApp para gerar um novo token.</p>
                </body>
            </html>
        `);
    }
    
    // Token válido, redirecionar para o dashboard com o token como parâmetro
    res.redirect(`/dashboard.html?token=${token}`);
});

// Rotas da API
app.get('/api/telas', autenticarAdmin, async (req, res) => {
    try {
        // Usando consultas diretas
        const database = db._getDb();
        database.all(`
            SELECT * FROM telas_streaming 
            ORDER BY status, plataforma, validade
        `, [], (err, rows) => {
            if (err) {
                console.error('Erro ao consultar telas:', err);
                return res.status(500).json({ erro: 'Erro interno ao consultar telas' });
            }
            res.json(rows);
        });
    } catch (erro) {
        console.error('Erro ao listar telas:', erro);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

app.get('/api/usuarios', autenticarAdmin, async (req, res) => {
    try {
        // Usando consultas diretas
        const database = db._getDb();
        database.all(`
            SELECT * FROM usuarios 
            ORDER BY nome
        `, [], (err, rows) => {
            if (err) {
                console.error('Erro ao consultar usuários:', err);
                return res.status(500).json({ erro: 'Erro interno ao consultar usuários' });
            }
            res.json(rows);
        });
    } catch (erro) {
        console.error('Erro ao listar usuários:', erro);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

app.post('/api/adicionar-saldo', autenticarAdmin, async (req, res) => {
    const { telefone, valor } = req.body;
    
    if (!telefone || !valor || isNaN(parseFloat(valor))) {
        return res.status(400).json({ erro: 'Parâmetros inválidos' });
    }
    
    try {
        await db.adicionarSaldo(telefone, parseFloat(valor), "Adição de saldo via painel web");
        const novoSaldo = await db.getSaldo(telefone);
        
        res.json({ sucesso: true, saldo: novoSaldo });
    } catch (erro) {
        console.error('Erro ao adicionar saldo:', erro);
        res.status(500).json({ erro: 'Erro ao adicionar saldo', detalhes: erro.message });
    }
});

app.post('/api/adicionar-tela', autenticarAdmin, async (req, res) => {
    const { plataforma, slot, email_usuario, senha, valor, validade } = req.body;
    
    if (!plataforma || !slot || !validade) {
        return res.status(400).json({ erro: 'Plataforma, slot e validade são campos obrigatórios' });
    }
    
    try {
        const resultado = await db.adicionarTela({
            plataforma,
            slot: parseInt(slot),
            email_usuario,
            senha,
            valor: parseFloat(valor || 22.00),
            validade
        });
        
        res.json({ sucesso: true, id: resultado.lastID });
    } catch (erro) {
        console.error('Erro ao adicionar tela:', erro);
        res.status(500).json({ erro: 'Erro ao adicionar tela', detalhes: erro.message });
    }
});

app.post('/api/remover-expirados', autenticarAdmin, async (req, res) => {
    try {
        const resultado = await db.removerExpirados();
        res.json({ sucesso: true, resultado });
    } catch (erro) {
        console.error('Erro ao remover itens expirados:', erro);
        res.status(500).json({ erro: 'Erro ao remover itens expirados', detalhes: erro.message });
    }
});

app.post('/api/enviar-aviso', autenticarAdmin, async (req, res) => {
    const { texto } = req.body;
    
    if (!texto || texto.trim() === '') {
        return res.status(400).json({ erro: 'O texto do aviso não pode ser vazio' });
    }
    
    try {
        // Obter todos os usuários do banco de dados
        const database = db._getDb();
        const usuarios = await new Promise((resolve, reject) => {
            database.all('SELECT telefone FROM usuarios', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        if (usuarios.length === 0) {
            return res.json({ sucesso: true, mensagem: "Nenhum usuário cadastrado para enviar mensagens" });
        }
        
        // Importar o cliente WhatsApp do módulo principal
        const index = require('./index');
        const client = index.getClient();
        
        // Contador para usuários processados
        let sucessos = 0;
        let falhas = 0;
        
        // Enviar mensagem para cada usuário
        const promessas = usuarios.map(async (usuario) => {
            try {
                // Formatar número no formato internacional para o WhatsApp (com @c.us)
                const numeroWhatsApp = `${usuario.telefone}@c.us`;
                
                // Enviar mensagem
                await client.sendMessage(numeroWhatsApp, texto);
                
                // Incrementar contador de sucesso
                sucessos++;
            } catch (erroEnvio) {
                console.error(`Erro ao enviar mensagem para ${usuario.telefone}:`, erroEnvio);
                falhas++;
            }
        });
        
        // Aguardar todas as promessas serem resolvidas
        await Promise.all(promessas);
        
        // Retornar resultado
        res.json({ 
            sucesso: true, 
            mensagem: `Aviso enviado com sucesso! Enviado para ${sucessos} usuários. Falhas: ${falhas}` 
        });
        
    } catch (erro) {
        console.error('Erro ao processar envio em massa:', erro);
        res.status(500).json({ erro: 'Erro ao processar envio em massa', detalhes: erro.message });
    }
});

// Obter estatísticas do sistema
app.get('/api/estatisticas', autenticarAdmin, async (req, res) => {
    try {
        const database = db._getDb();
        
        // Total de usuários
        const totalUsuarios = await new Promise((resolve, reject) => {
            database.get('SELECT COUNT(*) as total FROM usuarios', [], (err, row) => {
                if (err) reject(err);
                resolve(row ? row.total : 0);
            });
        });
        
        // Total de telas vendidas
        const telasVendidas = await new Promise((resolve, reject) => {
            database.get('SELECT COUNT(*) as total FROM telas_streaming WHERE status = "ocupado"', [], (err, row) => {
                if (err) reject(err);
                resolve(row ? row.total : 0);
            });
        });
        
        // Saldo médio por usuário
        const saldoMedio = await new Promise((resolve, reject) => {
            database.get('SELECT AVG(saldo) as media FROM usuarios', [], (err, row) => {
                if (err) reject(err);
                resolve(row ? row.media : 0);
            });
        });
        
        // Vendas recentes (último mês)
        const vendasRecentes = await new Promise((resolve, reject) => {
            database.all(`
                SELECT t.id, t.plataforma, t.dono, t.data_venda, u.nome
                FROM telas_streaming t
                JOIN usuarios u ON t.dono = u.telefone
                WHERE t.status = "ocupado" AND t.data_venda IS NOT NULL
                ORDER BY t.data_venda DESC
                LIMIT 10
            `, [], (err, rows) => {
                if (err) reject(err);
                resolve(rows || []);
            });
        });
        
        res.json({
            sucesso: true,
            estatisticas: {
                totalUsuarios,
                telasVendidas,
                saldoMedio: parseFloat(saldoMedio).toFixed(2),
                vendasRecentes
            }
        });
    } catch (erro) {
        console.error('Erro ao obter estatísticas:', erro);
        res.status(500).json({ erro: 'Erro ao obter estatísticas', detalhes: erro.message });
    }
});

// Nova rota para salvar chave PIX
app.post('/api/chave-pix', autenticarAdmin, async (req, res) => {
    const { chavePix, tipoChave } = req.body;
    
    if (!chavePix || !tipoChave) {
        return res.status(400).json({ erro: 'Chave PIX e tipo da chave são obrigatórios' });
    }
    
    try {
        // Salvamos como JSON para armazenar o tipo e o valor
        const dadosPix = JSON.stringify({
            tipo: tipoChave,
            chave: chavePix
        });
        
        await db.salvarConfiguracao('CHAVE_PIX', dadosPix);
        
        res.json({ 
            sucesso: true, 
            mensagem: 'Chave PIX cadastrada com sucesso!'
        });
    } catch (erro) {
        console.error('Erro ao salvar chave PIX:', erro);
        res.status(500).json({ 
            erro: 'Erro ao salvar chave PIX', 
            detalhes: erro.message 
        });
    }
});

// Rota para obter a chave PIX atual
app.get('/api/chave-pix', autenticarAdmin, async (req, res) => {
    try {
        const dadosPixJSON = await db.obterConfiguracao('CHAVE_PIX');
        
        if (!dadosPixJSON) {
            return res.json({ 
                sucesso: true, 
                temChave: false,
                mensagem: 'Nenhuma chave PIX cadastrada' 
            });
        }
        
        const dadosPix = JSON.parse(dadosPixJSON);
        
        res.json({ 
            sucesso: true,
            temChave: true,
            tipo: dadosPix.tipo,
            chave: dadosPix.chave
        });
    } catch (erro) {
        console.error('Erro ao obter chave PIX:', erro);
        res.status(500).json({ 
            erro: 'Erro ao obter chave PIX', 
            detalhes: erro.message 
        });
    }
});

// Rota para obter comprovantes pendentes
app.get('/api/comprovantes', autenticarAdmin, async (req, res) => {
    try {
        const comprovantes = await db.obterComprovantesPendentes();
        res.json({ sucesso: true, comprovantes });
    } catch (erro) {
        console.error('Erro ao obter comprovantes:', erro);
        res.status(500).json({ 
            erro: 'Erro ao obter comprovantes', 
            detalhes: erro.message 
        });
    }
});

// Rota para aprovar comprovante
app.post('/api/aprovar-comprovante', autenticarAdmin, async (req, res) => {
    const { id, valor } = req.body;
    
    if (!id || !valor) {
        return res.status(400).json({ erro: 'ID do comprovante e valor são obrigatórios' });
    }
    
    try {
        // Obtemos os dados do comprovante
        const database = db._getDb();
        const comprovante = await new Promise((resolve, reject) => {
            database.get('SELECT * FROM comprovantes WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!comprovante) {
            return res.status(404).json({ erro: 'Comprovante não encontrado' });
        }
        
        // Marcamos como aprovado
        await db.processarComprovante(id, 'aprovado', `Valor aprovado: R$ ${parseFloat(valor).toFixed(2)}`);
        
        // Adicionamos saldo ao usuário
        await db.adicionarSaldo(
            comprovante.telefone, 
            parseFloat(valor), 
            `Recarga via PIX - Comprovante #${id}`
        );
        
        res.json({ 
            sucesso: true, 
            mensagem: 'Comprovante aprovado e saldo adicionado com sucesso!' 
        });
    } catch (erro) {
        console.error('Erro ao aprovar comprovante:', erro);
        res.status(500).json({ 
            erro: 'Erro ao processar aprovação', 
            detalhes: erro.message 
        });
    }
});

// Rota para reprovar comprovante
app.post('/api/reprovar-comprovante', autenticarAdmin, async (req, res) => {
    const { id, motivo } = req.body;
    
    if (!id) {
        return res.status(400).json({ erro: 'ID do comprovante é obrigatório' });
    }
    
    try {
        await db.processarComprovante(id, 'reprovado', motivo || 'Comprovante inválido ou ilegível');
        
        res.json({ 
            sucesso: true, 
            mensagem: 'Comprovante reprovado com sucesso!' 
        });
    } catch (erro) {
        console.error('Erro ao reprovar comprovante:', erro);
        res.status(500).json({ 
            erro: 'Erro ao processar reprovação', 
            detalhes: erro.message 
        });
    }
});

// Rota para upload de comprovante (via bot)
app.post('/api/upload-comprovante', upload.single('comprovante'), async (req, res) => {
    try {
        const { telefone, valor } = req.body;
        
        if (!telefone || !valor || !req.file) {
            return res.status(400).json({ 
                sucesso: false, 
                erro: 'Telefone, valor e arquivo de comprovante são obrigatórios' 
            });
        }
        
        // Verificar se o usuário existe
        const usuario = await db.getUsuario(telefone);
        if (!usuario) {
            return res.status(404).json({ 
                sucesso: false, 
                erro: 'Usuário não encontrado' 
            });
        }
        
        // Registrar comprovante no banco de dados
        const resultado = await db.registrarComprovante(
            telefone,
            parseFloat(valor),
            req.file.path
        );
        
        res.json({ 
            sucesso: true, 
            mensagem: 'Comprovante enviado com sucesso! Aguarde a confirmação do administrador.',
            id: resultado.id
        });
    } catch (erro) {
        console.error('Erro ao processar upload:', erro);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro ao processar upload', 
            detalhes: erro.message 
        });
    }
});

// Rota para servir arquivos de comprovante
app.get('/uploads/:filename', autenticarAdmin, (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    res.sendFile(filePath);
});

// Rota para a página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
function iniciarPainel() {
    app.listen(PORT, () => {
        console.log(`Painel de administração do Ifood Das Contas e Streamings rodando na porta ${PORT}`);
    });
}

// Exportar função para iniciar o painel
module.exports = {
    iniciar: iniciarPainel
}; 