import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from openai import OpenAI
import requests
from datetime import datetime
import re
import time
from functools import wraps

# Load environment variables
load_dotenv()

app = Flask(__name__)

# DeepSeek API setup
api_key = os.getenv("DEEPSEEK_API_KEY")
client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

# Rate limiting implementation
RATE_LIMIT = 10  # requests per minute
request_times = []

def rate_limit(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        global request_times
        current_time = time.time()
        # Clean old requests (older than 1 minute)
        request_times = [t for t in request_times if current_time - t < 60]
        
        if len(request_times) >= RATE_LIMIT:
            return jsonify({"success": False, "error": "Rate limit exceeded. Please try again later."}), 429
        
        request_times.append(current_time)
        return func(*args, **kwargs)
    return wrapper

# Simple response cache
plan_cache = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/get_currency_rates', methods=['GET'])
def get_currency_rates():
    try:
        # Free ExchangeRate API for USD to KRW (Korean Won)
        response = requests.get('https://open.er-api.com/v6/latest/USD')
        data = response.json()
        
        usd_to_krw = data['rates']['KRW']
        last_updated = data['time_last_update_utc']
        
        return jsonify({
            'success': True,
            'usd_to_krw': usd_to_krw,
            'last_updated': last_updated
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

def format_travel_plan(plan):
    """Format the AI-generated travel plan into a more structured HTML format"""
    if not plan or not isinstance(plan, str):
        return plan
        
    # Format headings
    plan = re.sub(r'^# (.+)$', r'<h2 class="mt-4 mb-3">\1</h2>', plan, flags=re.MULTILINE)
    plan = re.sub(r'^## (.+)$', r'<h3 class="mt-4 mb-2">\1</h3>', plan, flags=re.MULTILINE)
    plan = re.sub(r'^### (.+)$', r'<h4 class="mt-4 mb-2 travel-day-heading">\1</h4>', plan, flags=re.MULTILINE)
    
    # Convert standalone **Title** format to headings and clean asterisks
    plan = re.sub(r'^[\s]*\*\*([^*\n]+)\*\*[\s]*$', r'<h3 class="mt-4 mb-2">\1</h3>', plan, flags=re.MULTILINE)
    
    # Format days
    plan = re.sub(r'(\d+\. Gün:|Gün \d+:)', r'<strong class="text-primary heading-day">\1</strong>', plan)
    
    # Format categories
    categories = [
        'Konaklama', 'Yemek', 'Aktivite', 'Ulaşım', 'Tur', 'Sabah', 'Öğle', 
        'Akşam', 'Öğle Yemeği', 'Akşam Yemeği', 'Kahvaltı', 'Öğleden Sonra'
    ]
    
    for category in categories:
        pattern = fr'\*\*{category}:\*\*'
        plan = re.sub(pattern, f'<strong class="category-heading">{category}:</strong>', plan)

    # Format tips and notes
    tip_patterns = ['İpucu:', 'Uyarı:', 'İletişim:', 'Ekstra İpuçları:', 'Temel Korece:', 'Genel İpuçları:', 'Not:']
    for tip in tip_patterns:
        pattern = fr'\*\*{tip}\*\*([^*]+)'
        plan = re.sub(pattern, f'<div class="alert alert-info tip-box"><strong class="tip-heading">{tip}</strong>\\1</div>', plan)
    
    # Format lists
    lines = plan.split('\n')
    formatted_lines = []
    in_list = False
    
    for line in lines:
        if line.strip().startswith('- '):
            if not in_list:
                formatted_lines.append('<ul class="mb-3">')
                in_list = True
            formatted_lines.append(f'<li>{line.strip()[2:]}</li>')
        elif line.strip() and re.match(r'^\d+\. ', line.strip()):
            if not in_list:
                formatted_lines.append('<ol class="mb-3">')
                in_list = True
            formatted_lines.append(f'<li>{line.strip()[line.find(".")+1:].strip()}</li>')
        else:
            if in_list:
                formatted_lines.append('</ul>' if '<ul' in formatted_lines[-2] else '</ol>')
                in_list = False
            if line.strip():
                if not (line.startswith('<h') or line.startswith('<div') or line.startswith('<ul') or line.startswith('<ol')):
                    # Clean any remaining asterisks for bold text in paragraphs
                    cleaned_line = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', line)
                    formatted_lines.append(f'<p class="mb-3">{cleaned_line}</p>')
                else:
                    formatted_lines.append(line)
            else:
                formatted_lines.append('')
    
    if in_list:
        formatted_lines.append('</ul>' if '<ul' in formatted_lines[-2] else '</ol>')
    
    # Wrap everything in a travel-plan div
    return '<div class="travel-plan">' + '\n'.join(formatted_lines) + '</div>'

@app.route('/generate_plan', methods=['POST'])
@rate_limit
def generate_plan():
    data = request.json
    
    # Log received data to help with debugging
    print(f"Received form data: {data}")
    
    # Ensure budget is processed correctly
    budget = data.get('budget')
    if budget is None:
        budget = '3000'  # Default only if budget is not provided
    else:
        try:
            # Don't modify the budget value from form
            budget = str(budget).strip()
            if not budget:
                budget = '3000'
        except ValueError:
            budget = '3000'  # Default if conversion fails
    
    # Log the budget for debugging
    print(f"Budget after processing: {budget}")
    
    # Create a cache key from the request data
    cache_key = f"{budget}_{data.get('duration')}_{data.get('travel_style')}_{','.join(data.get('interests', []))}_{data.get('food_preferences')}_{data.get('accommodation')}_{data.get('season')}_{data.get('travel_group', 'Solo')}_{data.get('travel_pace', 'Balanced')}_{data.get('cities', 'Seoul')}"
    
    # Check if we have this plan cached
    if cache_key in plan_cache:
        return jsonify(plan_cache[cache_key])
    
    # Format the prompt for DeepSeek AI with proper Turkish characters
    prompt = f"""
    ### ROL ###
    Sen, Türkiye'den gelen gezginler için uzman bir Güney Kore seyahat danışmanısın. Amacın, aşağıda verilen kullanıcı tercihlerine dayanarak, son derece detaylı, mantıksal tutarlılığı olan, kişiselleştirilmiş ve profesyonel bir seyahat planı oluşturmaktır.
    
    ### KULLANICI TERCİHLERİ ###
    - Seyahat Grubu: {data.get('travel_group', 'Tek Başıma')}
    - Bütçe: {budget} USD
    - Seyahat Süresi: {data.get('duration', '7')} gün
    - Seyahat Mevsimi/Ayı: {data.get('season', 'Spring')}
    - Tercih Edilen Şehirler: {data.get('cities', 'Sadece Seul')}
    - Seyahat Tarzı: {data.get('travel_style', 'Moderate')}
    - Seyahat Temposu: {data.get('travel_pace', 'Dengeli Keşif')}
    - Özel İlgi Alanları: {', '.join(data.get('interests', ['Culture & History']))}
    - Yemek Tercihleri: {data.get('food_preferences', 'Mix of Korean and international cuisine')}
    - Konaklama Tipi: {data.get('accommodation', 'Mid-range Hotels')}
    
    ### GÖREV ###
    Yukarıdaki tercihleri analiz ederek, gezgin için özel bir "Güney Kore Seyahat Planı ve İtinereri" oluştur.
    
    ### UYULMASI GEREKEN KESİN KURALLAR ###
    1. **Yerel Odak:** Plan içerisinde KESİNLİKLE hiçbir Türk mekanı, restoranı, kafesi veya işletmesi önerme. Odak noktası tamamen otantik Kore deneyimi olmalıdır.
    2. **Mantıksal Akış:** Aktiviteleri coğrafi olarak mantıklı bir sıraya koy. Bir gün içinde şehrin bir ucundan diğerine anlamsız geçişler yaptırma. Örneğin, bir gün Gangnam bölgesindeki yerleri, başka bir gün Hongdae bölgesindeki yerleri gezdir.
    3. **Kişiselleştirme:** Kullanıcının ilgi alanlarını plana somut olarak yansıt. Eğer "K-Pop" seçildiyse, plana K-Star Road veya HYBE Insight gibi yerleri ekle. Eğer "Tarih" seçildiyse Gyeongbokgung Sarayı ve Bukchon Hanok Köyü gibi yerlere öncelik ver.
    4. **Gerçekçilik:**
       * **Adres ve İletişim:** Konaklama yerleri ve turistik noktalar için gerçek ve tanınmış isimler kullan (Örn: "Lotte Hotel Seoul"). Ancak, AI olarak güncel adres ve telefon numarası veremeyeceğin için, bu bilgileri aşağıdaki gibi yer tutucu formatında belirt: `Adres: [Bölge Adı], Seul` ve `Telefon: [Gerçekçi Bir Formatla Yer Tutucu]`. Bu, yanlış bilgi verme riskini ortadan kaldırır.
       * **Bütçe ve Zaman:** Önerilen aktiviteler ve restoranlar, kullanıcının belirttiği "Bütçe" ve "Seyahat Tarzı" ile uyumlu olmalı. Lüks bir bütçeye sahip kullanıcıya Michelin yıldızlı restoranlar önerirken, sırt çantalı bir gezgine yerel ve uygun fiyatlı pazarları öner. Zamanlamalar tahmini ve esnek olmalıdır.
    
    ### ÇIKTI FORMATI ###
    Planı aşağıda belirtilen başlıklarla oluştur:
    
    # Güney Kore Seyahat Planı ve İtinereri
    
    ## Gezgin Profili ve Seyahat Özeti
    * **Seyahat Tarihleri:** [Seçilen Mevsim] Ayı, [Seyahat Süresi] Gün
    * **Seyahat Grubu:** [Seçilen Grup]
    * **Odak:** [Seçilen Şehirler]
    * **Tarz ve Bütçe:** [Seçilen Tarz], Yaklaşık [Seçilen Bütçe] USD
    * **İlgi Alanları:** [Seçilen İlgi Alanları]
    
    ## Detaylı Günlük Plan
    
    ### 1. Gün: [Şehir Adı]'na Varış ve Yerleşme
    
    **Konaklama:** [Otel/Hostel Adı], [Konaklama Tipi]
    **Adres:** [Bölge Adı], [Şehir Adı]
    **İletişim:** [Gerçekçi Formatla Yer Tutucu]
    
    **Günün Akışı:**
    * **15:00-16:00:** Otele yerleşme ve dinlenme.
    * **16:00-18:00:** [Yakınlardaki bir yerin keşfi, örn: Myeongdong Alışveriş Caddesi'nde ilk tur].
    * **18:00-19:30:** Akşam Yemeği: [Yemek Tercihine Uygun Restoran Önerisi ve Türü].
    * **20:00-Sonrası:** [Akşam Aktivitesi, örn: N Seoul Tower'dan gece manzarası].
    
    **Notlar:** T-money ulaşım kartınızı havaalanından veya metro istasyonlarından temin edin.
    
    ### 2. Gün: [Günün Teması, örn: Tarihin İzinde]
    
    (Diğer günler için de benzer detaylı format)
    
    ## Seyahat İpuçları
    
    1. **Ulaşım:** [Kore'de ulaşım hakkında ipuçları]
    2. **Para Birimi ve Ödemeler:** [Para birimi, kredi kartı kullanımı, ATM'ler hakkında bilgi]
    3. **İletişim:** [Wi-Fi, SIM kart ve internet erişimi hakkında bilgi]
    4. **Yerel Görgü Kuralları:** [Kore kültürüne özgü görgü kuralları]
    5. **Temel Korece İfadeler:** [Turistlerin bilmesi gereken temel ifadeler]
    
    ## Tahmini Bütçe Dökümü
    
    * **Konaklama:** [Toplam tahmini konaklama maliyeti]
    * **Yemek:** [Toplam tahmini yemek maliyeti]
    * **Ulaşım:** [Toplam tahmini ulaşım maliyeti]
    * **Aktiviteler ve Girişler:** [Toplam tahmini aktivite maliyeti]
    * **Alışveriş ve Ekstralar:** [Tahmini ekstra harcamalar]
    * **Toplam:** [Toplam tahmini maliyet]
    
    "Bu seyahat planı, belirtilen tercihler doğrultusunda turistik amaçlı olarak hazırlanmıştır."
    
    Tüm cevabını Türkçe olarak ver ve her gün için adım adım bir plan hazırla.
    """
    
    try:
        # Try to make the API request with exponential backoff
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[
                        {"role": "system", "content": "Sen Güney Kore turizmi konusunda uzmanlaşmış bir seyahat planlama uzmanısın. Tüm cevaplarını Türkçe olarak vermelisin."},
                        {"role": "user", "content": prompt},
                    ],
                    stream=False
                )
                break  # If successful, break the loop
            except Exception as e:
                if attempt == max_retries - 1:  # If this was the last attempt
                    raise e
                time.sleep(retry_delay)  # Wait before retrying
                retry_delay *= 2  # Exponential backoff
        
        plan = response.choices[0].message.content
        # Log the received plan (first 100 chars)
        print(f"Generated plan (first 100 chars): {plan[:100]}...")
        
        # Format the travel plan
        formatted_plan = format_travel_plan(plan)
        
        result = {
            "success": True, 
            "plan": formatted_plan,
            "date": datetime.now().strftime("%d.%m.%Y"),
            "summary": {
                "budget": budget,
                "duration": data.get('duration', '7'),
                "style": data.get('travel_style', 'Moderate'),
                "season": data.get('season', 'Spring'),
                "travel_group": data.get('travel_group', 'Tek Başıma'),
                "cities": data.get('cities', 'Sadece Seul')
            }
        }
        
        # Cache the result
        plan_cache[cache_key] = result
        
        return jsonify(result)
    except Exception as e:
        print(f"Error generating plan: {str(e)}")
        return jsonify({"success": False, "error": str(e)})

@app.route('/generate_korean_plan', methods=['POST'])
@rate_limit
def generate_korean_plan():
    data = request.json
    
    # Ensure budget is processed correctly
    budget = data.get('budget', '3000')
    try:
        budget = str(int(float(budget)))
    except ValueError:
        budget = '3000'
        
    # Create a cache key from the request data
    cache_key = f"korean_{budget}_{data.get('duration')}_{data.get('travel_style')}_{','.join(data.get('interests', []))}_{data.get('food_preferences')}_{data.get('accommodation')}_{data.get('season')}_{data.get('travel_group', 'Solo')}_{data.get('travel_pace', 'Balanced')}_{data.get('cities', 'Seoul')}"
    
    # Check if we have this plan cached
    if cache_key in plan_cache:
        return jsonify(plan_cache[cache_key])

    # Format the prompt for DeepSeek AI for Korean immigration/police format
    prompt = f"""
    ### ROL ###
    Sen, Türkiye'den gelen gezginler için uzman bir Güney Kore seyahat danışmanısın ve hem Korece hem Türkçe biliyorsun. Amacın, aşağıda verilen kullanıcı tercihlerine dayanarak, göçmenlik bürosu veya polis tarafından incelendiğinde profesyonel ve resmi görünecek bir seyahat planı oluşturmaktır.
    
    ### KULLANICI TERCİHLERİ ###
    - Seyahat Grubu: {data.get('travel_group', 'Tek Başıma')}
    - Bütçe: {budget} USD
    - Seyahat Süresi: {data.get('duration', '7')} gün
    - Seyahat Mevsimi/Ayı: {data.get('season', 'Spring')}
    - Tercih Edilen Şehirler: {data.get('cities', 'Sadece Seul')}
    - Seyahat Tarzı: {data.get('travel_style', 'Moderate')}
    - Seyahat Temposu: {data.get('travel_pace', 'Dengeli Keşif')}
    - Özel İlgi Alanları: {', '.join(data.get('interests', ['Culture & History']))}
    - Yemek Tercihleri: {data.get('food_preferences', 'Mix of Korean and international cuisine')}
    - Konaklama Tipi: {data.get('accommodation', 'Mid-range Hotels')}
    
    ### GÖREV ###
    Yukarıdaki tercihleri analiz ederek, göçmenlik bürosu ya da polis tarafından incelendiğinde profesyonel ve resmi görünecek bir "Güney Kore Seyahat Planı ve İtinereri" oluştur.
    
    Plan şunları içermelidir:
    1. Başlık olarak "Güney Kore Seyahat Planı ve İtinereri"
    2. Tam gezi tarihleri (sadece ay/mevsim belirt, net bir tarih uydurma)
    3. Her gün için konaklama yerleri
    4. Her gün için açık adresler ve ziyaret noktaları
    5. Turistin her günkü rotası ve tahmini zaman çizelgesi
    6. Konaklama yerlerinin adres ve iletişim bilgileri
    
    Aşağıdaki çıktıyı Türkçe ve Korece (Hangul) olarak yan yana sütunlar halinde sağla. Böylece hem ben okuyabileyim hem de gerektiğinde Korece kısmını göçmenlik bürosuna gösterebileceğim bir formatta olsun.
    
    Ayrıca, plan sonunda "Bu seyahat planı turistik amaçlıdır ve Güney Kore'nin göçmenlik kurallarına uygun hazırlanmıştır." ifadesini ekle.
    """
    
    try:
        # Try to make the API request with exponential backoff
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[
                        {"role": "system", "content": "Sen hem Korece hem Türkçe bilen, Kore göçmenlik prosedürlerini iyi anlayan bir seyahat belgeleri uzmanısın."},
                        {"role": "user", "content": prompt},
                    ],
                    stream=False
                )
                break  # If successful, break the loop
            except Exception as e:
                if attempt == max_retries - 1:  # If this was the last attempt
                    raise e
                time.sleep(retry_delay)  # Wait before retrying
                retry_delay *= 2  # Exponential backoff
        
        korean_plan = response.choices[0].message.content
        
        # Format Korean plan specifically for two-column layout
        formatted_korean_plan = format_korean_plan(korean_plan)
        
        result = {
            "success": True, 
            "plan": formatted_korean_plan,
            "date": datetime.now().strftime("%d.%m.%Y"),
            "summary": {
                "budget": budget,
                "duration": data.get('duration', '7'),
                "style": data.get('travel_style', 'Moderate'),
                "season": data.get('season', 'Spring'),
                "travel_group": data.get('travel_group', 'Tek Başıma'),
                "cities": data.get('cities', 'Sadece Seul')
            }
        }
        
        # Cache the result
        plan_cache[cache_key] = result
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

def format_korean_plan(plan):
    # Check if the plan has a table-like format with | characters
    if '|' in plan:
        rows = plan.split('\n')
        html = ['<div class="table-responsive"><table class="korean-plan-table">']
        
        for row in rows:
            if '|' in row:
                # Skip separator rows with dashes
                if row.strip().startswith('|--') or row.strip().startswith('| --'):
                    continue
                    
                # Process table row
                cols = row.split('|')
                if len(cols) > 2:  # Ensure there are at least 2 columns
                    html.append('<tr>')
                    # Skip the first and last empty elements from split
                    for col in cols[1:-1]:
                        html.append(f'<td>{col.strip()}</td>')
                    html.append('</tr>')
        
        html.append('</table></div>')
        return '\n'.join(html)
    else:
        # If not in table format, use regular formatting
        return format_travel_plan(plan)

if __name__ == '__main__':
    app.run(host='0.0.0.0') 