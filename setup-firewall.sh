#!/bin/bash

# Script per configurare il firewall per l'accesso LAN

echo "🔥 Configurazione firewall per accesso LAN..."
echo ""

# Verifica se ufw è installato
if ! command -v ufw &> /dev/null; then
    echo "⚠️  UFW non installato. Installazione..."
    sudo apt update
    sudo apt install -y ufw
fi

# Abilita il firewall se non è già attivo
if ! sudo ufw status | grep -q "Status: active"; then
    echo "🔓 Abilitazione firewall..."
    sudo ufw enable
fi

# Permetti SSH (importante per non perdere la connessione!)
echo "✅ Permetti SSH (porta 22)..."
sudo ufw allow 22/tcp

# Permetti le porte dell'applicazione
echo "✅ Permetti Backend (porta 3000)..."
sudo ufw allow 3000/tcp

echo "✅ Permetti Frontend (porta 4200)..."
sudo ufw allow 4200/tcp

# Permetti PostgreSQL se necessario (solo per connessioni locali)
echo "✅ Permetti PostgreSQL (porta 5432) - solo localhost..."
sudo ufw allow from 127.0.0.1 to any port 5432

echo ""
echo "✅ Firewall configurato!"
echo ""
echo "📊 Status firewall:"
sudo ufw status numbered
echo ""
echo "⚠️  ATTENZIONE: Assicurati che la porta SSH (22) sia aperta!"
echo ""
