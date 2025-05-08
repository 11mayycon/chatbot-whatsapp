const sqlite3 = require('sqlite3').verbose();
const config = require('./config');
const path = require('path');
const fs = require('fs');

// Diretório para o banco de dados
const DB_DIR = path.dirname(config.DATABASE_FILE);
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Inicializar banco de dados
const db = new sqlite3.Database(config.DATABASE_FILE);

// Inicialização das tabelas
db.serialize(() => {
    // Tabela de usuários
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        telefone TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        saldo REAL DEFAULT 0,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ultima_interacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de transações
    db.run(`CREATE TABLE IF NOT EXISTS transacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telefone TEXT,
        valor REAL NOT NULL,
        tipo TEXT NOT NULL,
        descricao TEXT,
        data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(telefone) REFERENCES usuarios(telefone)
    )`);

    // Tabela de telas de streaming
    db.run(`CREATE TABLE IF NOT EXISTS telas_streaming (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plataforma TEXT NOT NULL,
        slot INTEGER NOT NULL,
        email_usuario TEXT,
        senha TEXT,
        valor REAL DEFAULT 22.00,
        status TEXT DEFAULT 'disponível',
        dono TEXT,
        data_venda TIMESTAMP,
        validade TEXT,
        FOREIGN KEY(dono) REFERENCES usuarios(telefone)
    )`);
    
    // Tabela de configurações
    db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chave TEXT UNIQUE NOT NULL,
        valor TEXT NOT NULL,
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Tabela de comprovantes
    db.run(`CREATE TABLE IF NOT EXISTS comprovantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telefone TEXT NOT NULL,
        valor REAL NOT NULL,
        caminho_imagem TEXT NOT NULL,
        status TEXT DEFAULT 'pendente', 
        data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_processamento TIMESTAMP,
        observacao TEXT,
        FOREIGN KEY(telefone) REFERENCES usuarios(telefone)
    )`);
});

// Funções para manipulação de usuários
async function cadastrarUsuario(telefone, nome) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR IGNORE INTO usuarios (telefone, nome) VALUES (?, ?)`,
            [telefone, nome],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

async function getUsuario(telefone) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM usuarios WHERE telefone = ?`,
            [telefone],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

async function atualizarInteracao(telefone) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE usuarios SET ultima_interacao = CURRENT_TIMESTAMP WHERE telefone = ?`,
            [telefone],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

// Funções para manipulação de saldo
async function getSaldo(telefone) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT saldo FROM usuarios WHERE telefone = ?`,
            [telefone],
            (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.saldo : 0);
            }
        );
    });
}

async function adicionarSaldo(telefone, valor, descricao) {
    return new Promise((resolve, reject) => {
        db.run(
            `BEGIN TRANSACTION;`,
            [],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                db.run(
                    `UPDATE usuarios SET saldo = saldo + ? WHERE telefone = ?`,
                    [valor, telefone],
                    function(err) {
                        if (err) {
                            db.run(`ROLLBACK;`);
                            reject(err);
                            return;
                        }
                        
                        db.run(
                            `INSERT INTO transacoes (telefone, valor, tipo, descricao) VALUES (?, ?, ?, ?)`,
                            [telefone, valor, 'credito', descricao],
                            function(err) {
                                if (err) {
                                    db.run(`ROLLBACK;`);
                                    reject(err);
                                    return;
                                }
                                
                                db.run(`COMMIT;`, [], function(err) {
                                    if (err) {
                                        db.run(`ROLLBACK;`);
                                        reject(err);
                                        return;
                                    }
                                    resolve(true);
                                });
                            }
                        );
                    }
                );
            }
        );
    });
}

async function removerSaldo(telefone, valor, descricao) {
    return new Promise((resolve, reject) => {
        db.run(
            `BEGIN TRANSACTION;`,
            [],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Verificar se há saldo suficiente
                db.get(
                    `SELECT saldo FROM usuarios WHERE telefone = ?`,
                    [telefone],
                    (err, row) => {
                        if (err) {
                            db.run(`ROLLBACK;`);
                            reject(err);
                            return;
                        }
                        
                        const saldoAtual = row ? row.saldo : 0;
                        if (saldoAtual < valor) {
                            db.run(`ROLLBACK;`);
                            resolve({
                                sucesso: false,
                                mensagem: "Saldo insuficiente",
                                saldo: saldoAtual
                            });
                            return;
                        }
                        
                        // Atualizar saldo
                        db.run(
                            `UPDATE usuarios SET saldo = saldo - ? WHERE telefone = ?`,
                            [valor, telefone],
                            function(err) {
                                if (err) {
                                    db.run(`ROLLBACK;`);
                                    reject(err);
                                    return;
                                }
                                
                                // Registrar transação
                                db.run(
                                    `INSERT INTO transacoes (telefone, valor, tipo, descricao) VALUES (?, ?, ?, ?)`,
                                    [telefone, valor, 'debito', descricao],
                                    function(err) {
                                        if (err) {
                                            db.run(`ROLLBACK;`);
                                            reject(err);
                                            return;
                                        }
                                        
                                        db.run(`COMMIT;`, [], function(err) {
                                            if (err) {
                                                db.run(`ROLLBACK;`);
                                                reject(err);
                                                return;
                                            }
                                            
                                            const novoSaldo = saldoAtual - valor;
                                            resolve({
                                                sucesso: true,
                                                mensagem: "Débito realizado com sucesso",
                                                saldo: novoSaldo
                                            });
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    });
}

// Funções para telas de streaming
async function adicionarTela(tela) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO telas_streaming (plataforma, slot, email_usuario, senha, valor, validade) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                tela.plataforma, 
                tela.slot, 
                tela.email_usuario || null, 
                tela.senha || null, 
                tela.valor || 22.00, 
                tela.validade
            ],
            function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            }
        );
    });
}

async function getTelasDisponiveis() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM telas_streaming WHERE status = 'disponível' ORDER BY plataforma, slot`,
            [],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

async function getDetalheTela(id) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM telas_streaming WHERE id = ?`,
            [id],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

async function venderTela(id, telefone) {
    return new Promise((resolve, reject) => {
        db.run(
            `BEGIN TRANSACTION;`,
            [],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Verificar se a tela está disponível
                db.get(
                    `SELECT * FROM telas_streaming WHERE id = ? AND status = 'disponível'`,
                    [id],
                    (err, row) => {
                        if (err) {
                            db.run(`ROLLBACK;`);
                            reject(err);
                            return;
                        }
                        
                        if (!row) {
                            db.run(`ROLLBACK;`);
                            resolve({
                                sucesso: false,
                                mensagem: "Tela não disponível para venda"
                            });
                            return;
                        }
                        
                        // Marcar tela como vendida
                        db.run(
                            `UPDATE telas_streaming SET status = 'ocupado', dono = ?, data_venda = CURRENT_TIMESTAMP WHERE id = ?`,
                            [telefone, id],
                            function(err) {
                                if (err) {
                                    db.run(`ROLLBACK;`);
                                    reject(err);
                                    return;
                                }
                                
                                db.run(`COMMIT;`, [], function(err) {
                                    if (err) {
                                        db.run(`ROLLBACK;`);
                                        reject(err);
                                        return;
                                    }
                                    
                                    resolve({
                                        sucesso: true,
                                        mensagem: "Tela vendida com sucesso"
                                    });
                                });
                            }
                        );
                    }
                );
            }
        );
    });
}

async function removerExpirados() {
    return new Promise((resolve, reject) => {
        const hoje = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        
        db.run(
            `UPDATE telas_streaming SET status = 'expirado' WHERE validade < ? AND status = 'disponível'`,
            [hoje],
            function(err) {
                if (err) reject(err);
                else resolve({ telas: this.changes });
            }
        );
    });
}

// Funções para configurações
async function salvarConfiguracao(chave, valor) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO configuracoes (chave, valor, data_atualizacao) 
             VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(chave) 
             DO UPDATE SET valor = ?, data_atualizacao = CURRENT_TIMESTAMP`,
            [chave, valor, valor],
            function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            }
        );
    });
}

async function obterConfiguracao(chave) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT valor FROM configuracoes WHERE chave = ?`,
            [chave],
            (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.valor : null);
            }
        );
    });
}

// Funções para comprovantes
async function registrarComprovante(telefone, valor, caminhoImagem) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO comprovantes (telefone, valor, caminho_imagem) 
             VALUES (?, ?, ?)`,
            [telefone, valor, caminhoImagem],
            function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            }
        );
    });
}

async function obterComprovantesPendentes() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT c.*, u.nome
             FROM comprovantes c
             JOIN usuarios u ON c.telefone = u.telefone
             WHERE c.status = 'pendente'
             ORDER BY c.data_envio DESC`,
            [],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

async function processarComprovante(id, status, observacao = null) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE comprovantes 
             SET status = ?, 
                 data_processamento = CURRENT_TIMESTAMP,
                 observacao = ?
             WHERE id = ?`,
            [status, observacao, id],
            function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            }
        );
    });
}

// Função para obter a instância do banco
function _getDb() {
    return db;
}

// Exportar funções
module.exports = {
    cadastrarUsuario,
    getUsuario,
    atualizarInteracao,
    getSaldo,
    adicionarSaldo,
    removerSaldo,
    adicionarTela,
    getTelasDisponiveis,
    getDetalheTela,
    venderTela,
    removerExpirados,
    salvarConfiguracao,
    obterConfiguracao,
    registrarComprovante,
    obterComprovantesPendentes,
    processarComprovante,
    _getDb
}; 