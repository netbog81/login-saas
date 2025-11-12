#!/bin/bash

# Script per configurare automaticamente l'accesso LAN

echo "🌐 Configurazione accesso LAN per il calendario..."
echo ""

# Rileva l'IP della VM (esclude localhost e docker)
VM_IP=$(hostname -I | awk '{print $1}')

if [ -z "$VM_IP" ]; then
    echo "❌ Impossibile rilevare l'IP della VM"
    VM_IP="<IP_NON_RILEVATO>"
fi

echo "✅ IP rilevato: $VM_IP"
echo ""
echo "ℹ️  Il frontend rileva automaticamente l'IP dal browser!"
echo "   Non serve configurare manualmente l'URL del backend."
echo ""
echo "📌 Informazioni accesso:"
echo "   Backend:  http://${VM_IP}:3000"
echo "   Frontend: http://${VM_IP}:4200"
echo ""
echo "   Oppure da localhost:"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:4200"
echo ""
echo "🚀 Per avviare il sistema:"
echo ""
echo "   Terminale 1 - Backend:"
echo "   cd backend && npm run start:dev"
echo ""
echo "   Terminale 2 - Frontend (accesso LAN):"
echo "   cd frontend && npm run start:lan"
echo ""
echo "   Oppure (solo localhost):"
echo "   cd frontend && npm start"
echo ""
echo "🔥 Configura il firewall con:"
echo "   ./setup-firewall.sh"
echo ""
