# Instruções para Transferência do Bot para VPS

## 1. Preparação Local

Antes de transferir os arquivos, certifique-se de que:

- O `.gitignore` está configurado para excluir arquivos desnecessários
- A pasta `node_modules` não precisa ser transferida (será reinstalada na VPS)
- O arquivo `database.db` pode ser transferido se você deseja manter os dados existentes

## 2. Transferência de Arquivos

### Opção 1: Usando SCP (recomendado)

```bash
# Substitua usuario@ip-da-vps pelo seu usuário e IP da VPS
# Substitua /caminho/na/vps pelo caminho onde deseja instalar o bot
scp -r ./* usuario@ip-da-vps:/caminho/na/vps/
```

### Opção 2: Usando um cliente SFTP

Você pode usar FileZilla ou outro cliente SFTP para transferir os arquivos:
- Host: IP da sua VPS
- Username: Seu usuário na VPS
- Password: Sua senha
- Porta: 22 (padrão para SSH)

## 3. Configuração na VPS

Depois que os arquivos forem transferidos, conecte-se à VPS via SSH:

```bash
ssh usuario@ip-da-vps
```

Navegue até a pasta do projeto:

```bash
cd /caminho/na/vps/
```

Instale as dependências:

```bash
npm install
```

## 4. Configurando PM2

O projeto já inclui um arquivo `ecosystem.config.js` para o PM2. Para iniciar:

```bash
# Instale o PM2 globalmente, se ainda não estiver instalado
npm install -g pm2

# Inicie a aplicação com PM2
pm2 start ecosystem.config.js

# Configure o PM2 para iniciar automaticamente após reinicialização
pm2 startup
pm2 save
```

## 5. Verificando o status

```bash
# Verifique se a aplicação está rodando
pm2 status

# Veja os logs
pm2 logs ifood-das-contas-e-streamings
```

## Possíveis Problemas e Soluções

### Puppeteer/Chromium na VPS

O WhatsApp Web.js usa Puppeteer, que pode precisar de dependências adicionais em um servidor Linux:

```bash
# Para servidores Debian/Ubuntu
sudo apt update
sudo apt install -y gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

### Persistência da Sessão WhatsApp

A pasta `.wwebjs_auth` contém os dados de autenticação do WhatsApp. Se transferir essa pasta, evitará ter que escanear o QR code novamente.

## 6. Proxy Reverso (opcional)

Se você deseja expor o painel admin através de um domínio, configure um proxy reverso com Nginx:

```bash
sudo apt install nginx

# Crie um arquivo de configuração para o site
sudo nano /etc/nginx/sites-available/ifood-bot

# Adicione a configuração:
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    location / {
        proxy_pass http://localhost:3002;  # Porta do painel admin
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Ative o site
sudo ln -s /etc/nginx/sites-available/ifood-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 7. Comandos Úteis

```bash
# Reiniciar o bot
pm2 restart ifood-das-contas-e-streamings

# Ver logs em tempo real
pm2 logs ifood-das-contas-e-streamings --lines 100

# Parar o bot
pm2 stop ifood-das-contas-e-streamings

# Iniciar o bot
pm2 start ifood-das-contas-e-streamings
``` 