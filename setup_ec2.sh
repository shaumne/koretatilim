#!/bin/bash
set -e

# Renk tanımlamaları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log fonksiyonu
log() {
    echo -e "${GREEN}[$(date +"%Y-%m-%d %H:%M:%S")] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +"%Y-%m-%d %H:%M:%S")] ERROR: $1${NC}" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date +"%Y-%m-%d %H:%M:%S")] WARNING: $1${NC}"
}

# Kullanıcı girdileri
read -p "GitHub Repo URL (örn: https://github.com/username/koretatilim.git): " REPO_URL
read -p "Domain Adı (örn: koretatilim.com): " DOMAIN_NAME
read -p "E-posta adresi (SSL için): " EMAIL
read -p "DeepSeek API Anahtarı: " API_KEY

if [ -z "$REPO_URL" ] || [ -z "$DOMAIN_NAME" ] || [ -z "$EMAIL" ] || [ -z "$API_KEY" ]; then
    error "Tüm alanlar doldurulmalıdır!"
fi

# Ana dizini ayarla
APP_DIR="/var/www/koretatilim"

# 1. Sistem güncellemesi
log "Sistem güncelleniyor..."
sudo apt-get update && sudo apt-get upgrade -y || error "Sistem güncellemesi başarısız oldu"

# 2. Gerekli paketleri yükle
log "Gerekli paketler yükleniyor..."
sudo apt-get install -y python3 python3-pip python3-venv nginx git certbot python3-certbot-nginx || error "Paket kurulumu başarısız oldu"

# 3. GitHub'dan repo çek
log "GitHub reposu çekiliyor..."
if [ -d "$APP_DIR" ]; then
    warning "$APP_DIR zaten mevcut, yedek alınıyor..."
    mv "$APP_DIR" "${APP_DIR}_backup_$(date +%s)"
fi

sudo mkdir -p "$APP_DIR"
sudo git clone $REPO_URL "$APP_DIR" || error "GitHub repo çekme işlemi başarısız oldu"
sudo chown -R $USER:$USER "$APP_DIR"

# 4. Python sanal ortamı oluştur ve bağımlılıkları kur
log "Python sanal ortamı oluşturuluyor..."
cd "$APP_DIR"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt || error "Python bağımlılıklarının kurulumu başarısız oldu"
pip install gunicorn || error "Gunicorn kurulumu başarısız oldu"

# 5. .env dosyasını oluştur
log ".env dosyası oluşturuluyor..."
cat > "$APP_DIR/.env" << EOF
DEEPSEEK_API_KEY=$API_KEY
EOF

# 6. Systemd service dosyası oluştur
log "Systemd service dosyası oluşturuluyor..."
cat > /tmp/koretatilim.service << EOF
[Unit]
Description=Kore Tatil Planlayıcı
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=$APP_DIR
Environment="PATH=$APP_DIR/venv/bin"
ExecStart=$APP_DIR/venv/bin/gunicorn --workers 3 --bind unix:$APP_DIR/koretatilim.sock wsgi:app

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/koretatilim.service /etc/systemd/system/

# 7. Nginx yapılandırması
log "Nginx yapılandırması oluşturuluyor..."
cat > /tmp/koretatilim << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;

    location / {
        include proxy_params;
        proxy_pass http://unix:$APP_DIR/koretatilim.sock;
    }

    location /static {
        alias $APP_DIR/static;
    }
}
EOF

sudo mv /tmp/koretatilim /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/koretatilim /etc/nginx/sites-enabled/

# 8. İzinleri ayarla
log "İzinler ayarlanıyor..."
sudo chown -R www-data:www-data "$APP_DIR"
sudo chmod -R 755 "$APP_DIR"

# 9. Servisleri başlat
log "Servisler başlatılıyor..."
sudo systemctl daemon-reload
sudo systemctl start koretatilim
sudo systemctl enable koretatilim
sudo systemctl restart nginx

# 10. Domainin EC2 instance'ına yönlendirildiğini kontrol et
log "DNS kayıtlarının doğru ayarlandığından emin olun. A kaydı $DOMAIN_NAME için EC2 instance'ınızın IP adresini göstermelidir."
echo "IP adresi kontrol ediliyor..."
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com)
echo -e "EC2 Public IP: ${GREEN}$PUBLIC_IP${NC}"
echo -e "Domaininizin ($DOMAIN_NAME) DNS A kaydını bu IP adresine yönlendirdiğinizden emin olun."

# 11. SSL sertifikası al
log "DNS ayarlarınızı yaptıktan sonra SSL kurulumuna devam etmek için Enter tuşuna basın..."
read -p ""

log "SSL sertifikası alınıyor..."
sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME --non-interactive --agree-tos -m $EMAIL || warning "SSL sertifikası alınamadı. DNS ayarlarınız henüz aktif olmayabilir."

# 12. Otomatik yenileme için cron job ayarla
log "SSL sertifikası yenileme işlemi için cron job ayarlanıyor..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet") | crontab -

# 13. Uygulama durumunu kontrol et
log "Servis durumu kontrol ediliyor..."
sudo systemctl status koretatilim --no-pager

log "====== KURULUM TAMAMLANDI ======"
echo "Uygulamanıza şu adresten erişebilirsiniz: https://$DOMAIN_NAME"
echo "Herhangi bir sorun olursa, log dosyalarını kontrol edin:"
echo "- Application Logs: sudo journalctl -u koretatilim"
echo "- Nginx Logs: sudo tail -f /var/log/nginx/error.log"

# Basit bir izleme ve sorun giderme betiği oluştur
cat > "$APP_DIR/monitoring.sh" << EOF
#!/bin/bash
echo "===== Sistem Durumu ====="
echo "Disk Kullanımı:"
df -h
echo -e "\nBellek Kullanımı:"
free -m
echo -e "\nCPU Yükü:"
uptime
echo -e "\nKoretatilim Servis Durumu:"
systemctl status koretatilim --no-pager
echo -e "\nNginx Servis Durumu:"
systemctl status nginx --no-pager
echo -e "\nSon 20 Log Satırı:"
journalctl -u koretatilim -n 20 --no-pager
EOF

chmod +x "$APP_DIR/monitoring.sh"
log "İzleme betiği oluşturuldu: $APP_DIR/monitoring.sh"

exit 0 