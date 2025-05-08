# Ifood Das Contas e Streamings

Bot inteligente para WhatsApp focado em vendas de telas de streaming, com integração com IA (Groq), funcionalidades automatizadas, painel admin, e pronto para rodar em uma VPS com PM2.

## Características

- 🤖 Bot de WhatsApp completo usando whatsapp-web.js
- 🧠 Integração com Groq API para respostas inteligentes
- 💾 Banco de dados SQLite para armazenamento local
- 👨‍💻 Painel de administração para gerenciar telas e usuários
- 🚀 Configurado para execução via PM2 em VPS

## Estrutura do Projeto

- `index.js`: Arquivo principal do bot
- `database.js`: Gerenciamento do banco de dados SQLite
- `groq_api.js`: Integração com a API Groq para IA
- `admin.js`: Lógica dos comandos administrativos
- `painel.js`: API para o painel web de administração
- `painel-starter.js`: Inicializador do painel web
- `public/`: Arquivos estáticos do painel web
- `ecosystem.config.js`: Configuração para o PM2

## Requisitos

- Node.js v16+ (recomendado v18 LTS)
- NPM ou Yarn
- PM2 (para produção)
- Visual Studio Build Tools (para Windows, necessário para SQLite)
- Acesso à internet para a API do Groq

## Instalação

### Windows:

1. Instale o Node.js de https://nodejs.org/ (versão LTS recomendada)

2. Instale o Visual Studio Build Tools:
   - Baixe e instale o [Visual Studio Build Tools](https://visualstudio.microsoft.com/pt-br/visual-cpp-build-tools/)
   - Durante a instalação, selecione "Desenvolvimento para desktop com C++"

3. Clone este repositório:
```
git clone https://github.com/seu-usuario/ifood-das-contas-e-streamings.git
cd ifood-das-contas-e-streamings
```

4. Instale as dependências:
```
npm install
```

5. Configure suas chaves no arquivo `config.js`:
- Adicione os números de telefone dos administradores (formato: 55XXXXXXXXXXX)
- Verifique a API Key do Groq

### Linux:

1. Instale o Node.js e dependências para SQLite:
```
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y build-essential python3
```

2. Clone e instale o projeto:
```
git clone https://github.com/seu-usuario/ifood-das-contas-e-streamings.git
cd ifood-das-contas-e-streamings
npm install
```

## Executando o Bot

### Desenvolvimento

Para rodar o bot em modo de desenvolvimento:

```
npm run dev
```

### Produção (com PM2)

Para rodar o bot em produção:

```
pm2 start ecosystem.config.js
```

Isto inicializará:
- O bot de WhatsApp (ifood-das-contas-e-streamings)
- O painel de administração web (painel-admin)

## Uso do Painel Administrativo

O painel web estará disponível em:

```
http://seu-servidor:3000/?telefone=XXXXXXXXXX
```

Onde `XXXXXXXXXX` é um número de telefone administrativo configurado em `config.js`.

## Comandos Administrativos (Via WhatsApp)

Para usuários com números administrativos, os seguintes comandos estão disponíveis:

- `/add_tela plataforma slot validade` - Adicionar nova tela
- `/saldo @numero [+/-valor]` - Consultar ou alterar saldo
- `/editar_boasvindas texto` - Alterar mensagem inicial
- `/relatorios [tipo]` - Gerar relatórios
- `/remover_expirados` - Limpar telas vencidas

## Solução de Problemas

### Erro no SQLite

Se você encontrar erros na instalação do SQLite, verifique:

1. No Windows, certifique-se de ter instalado o Visual Studio Build Tools com "Desenvolvimento para desktop com C++"
2. No Linux, certifique-se de ter instalado `build-essential` e Python
3. Tente reinstalar a dependência do SQLite isoladamente:
```
npm install sqlite3 --build-from-source
```

## Notas de Segurança

1. Não compartilhe sua API Key do Groq
2. Proteja o acesso ao seu servidor/VPS
3. Considere adicionar autenticação mais robusta ao painel web para produção
4. Faça backups regulares do arquivo de banco de dados

## Suporte

Para questões, problemas ou sugestões, entre em contato com o desenvolvedor:
Maicon Correia, CEO da GringoStar Nacional
Contato: +55 11 9781-97645 