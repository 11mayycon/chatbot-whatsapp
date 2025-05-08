#!/bin/bash

# Script para preparar arquivos para transferência para VPS
# Autor: Ifood das Contas e Streamings

echo "=== Preparando arquivos para transferência ==="

# Nome do arquivo compactado
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARQUIVO="ifood_bot_$TIMESTAMP.tar.gz"

# Cria pasta temporária
TEMP_DIR="temp_transfer"
mkdir -p $TEMP_DIR

# Copia arquivos relevantes
echo "Copiando arquivos necessários..."
cp -r *.js *.json *.md public uploads $TEMP_DIR/

# Opcionalmente, copiar banco de dados se existir
if [ -f "database.db" ]; then
    echo "Copiando banco de dados..."
    cp database.db $TEMP_DIR/
fi

# Opcionalmente, copiar .wwebjs_auth se existir (para manter a sessão do WhatsApp)
if [ -d ".wwebjs_auth" ]; then
    echo "Copiando dados de autenticação do WhatsApp..."
    cp -r .wwebjs_auth $TEMP_DIR/
fi

# Copiar os scripts preparados
cp vps_setup.sh INSTRUCOES_VPS.md $TEMP_DIR/

# Entrar no diretório e compactar
echo "Compactando arquivos..."
cd $TEMP_DIR
tar -czf "../$ARQUIVO" .
cd ..

# Remover diretório temporário
rm -rf $TEMP_DIR

echo "=== Arquivos preparados com sucesso! ==="
echo "Arquivo compactado: $ARQUIVO"
echo ""
echo "Para transferir para a VPS, use o comando:"
echo "scp $ARQUIVO usuario@ip-da-vps:/caminho/na/vps/"
echo ""
echo "Depois de transferir, na VPS execute:"
echo "tar -xzf $ARQUIVO"
echo "chmod +x vps_setup.sh"
echo "./vps_setup.sh" 