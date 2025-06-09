# Kore Tatil Planlayıcısı

Bu uygulama, kullanıcıların Güney Kore seyahati planlamalarına yardımcı olmak için AI destekli bir seyahat planlayıcı sunar.

## Özellikler

- Kişiselleştirilmiş seyahat planları
- İlgi alanlarına göre öneriler
- Bütçeye uygun planlamalar
- Göçmenlik için resmi seyahat planı formatı
- Para birimi dönüştürücü
- PDF indirme seçeneği

## Kurulum

1. Gereklilikleri yükleyin:

```bash
pip install -r requirements.txt
```

2. .env dosyasını oluşturun:

```
DEEPSEEK_API_KEY=your_api_key_here
```

3. Uygulamayı başlatın:

### Geliştirme
```bash
python app.py
```

### Üretim
```bash
gunicorn wsgi:app
```

## Teknolojiler

- Flask
- DeepSeek AI API
- Bootstrap
- jsPDF 