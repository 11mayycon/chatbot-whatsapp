#!/bin/bash

# Script de configuração para Bot WhatsApp na VPS
# Autor: Ifood das Contas e Streamings

echo "=== Iniciando configuração do Bot WhatsApp na VPS ==="

# Atualiza os pacotes
echo "Atualizando pacotes do sistema..."
sudo apt update
sudo apt upgrade -y

# Instala o Node.js e NPM se não estiverem instalados
if ! command -v node &> /dev/null; then
    echo "Instalando Node.js e NPM..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    
    # Verifica se a instalação foi bem-sucedida
    node -v
    npm -v
fi

# Instala dependências do Puppeteer (necessárias para o WhatsApp Web.js)
echo "Instalando dependências do Puppeteer..."
sudo apt install -y gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

# Instala PM2 globalmente
echo "Instalando PM2 para gerenciamento de processos..."
npm install -g pm2

# Instala dependências do projeto
echo "Instalando dependências do projeto..."
npm install

# Cria a pasta uploads se não existir
mkdir -p uploads

# Verifica se o arquivo de banco de dados existe
if [ ! -f "database.db" ]; then
    echo "Criando banco de dados..."
    node -e "require('./database');"
fi

echo "=== Configuração concluída! ==="
echo "Para iniciar o bot, execute: pm2 start ecosystem.config.js"
echo "Para configurar o PM2 para iniciar na reinicialização do sistema: pm2 startup && pm2 save" 