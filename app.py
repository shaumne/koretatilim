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
    cache_key = f"{budget}_{data.get('duration')}_{data.get('travel_style')}_{','.join(data.get('interests', []))}_{data.get('food_preferences')}_{data.get('accommodation')}_{data.get('season')}"
    
    # Check if we have this plan cached
    if cache_key in plan_cache:
        return jsonify(plan_cache[cache_key])
    
    # Format the prompt for DeepSeek AI with proper Turkish characters
    prompt = f"""
    Güney Kore'ye aşağıdaki tercihlerimle bir seyahat planlıyorum:
    - Bütçe: {budget} USD
    - Seyahat Süresi: {data.get('duration', '7')} gün
    - Seyahat Tarzı: {data.get('travel_style', 'Moderate')}
    - İlgi Alanları: {', '.join(data.get('interests', ['Cultural']))}
    - Yemek Tercihleri: {data.get('food_preferences', 'Mix of Korean and international cuisine')}
    - Konaklama Türü: {data.get('accommodation', 'Mid-range Hotels')}
    - Seyahat Mevsimi/Ayı: {data.get('season', 'Spring')}
    
    Lütfen bana Güney Kore seyahatim için günlük ayrıntılı bir gezi planı sunar mısın?
    Aşağıdakileri içeren özel öneriler ekle:
    1. Her gün ziyaret edilecek yerler
    2. Yemek tercihlerime uygun restoran önerileri
    3. Bütçeme uygun konaklama seçenekleri
    4. Her gün için tahmini maliyetler
    5. Konumlar arasında ulaşım ipuçları
    6. İlgi alanlarıma göre mutlaka denenmesi gereken aktiviteler
    7. Yerel kültür ipuçları ve görgü kuralları
    8. Kore'de insanlarla iletişim kurma püf noktaları
    9. Para birimi, bahşiş kültürü, alışveriş yapma ipuçları
    10. Önemli Korece ifadeler ve turistlerin bilmesi gereken kelimeler
    
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
                "season": data.get('season', 'Spring')
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
    cache_key = f"korean_{budget}_{data.get('duration')}_{data.get('travel_style')}_{','.join(data.get('interests', []))}_{data.get('food_preferences')}_{data.get('accommodation')}_{data.get('season')}"
    
    # Check if we have this plan cached
    if cache_key in plan_cache:
        return jsonify(plan_cache[cache_key])

    # Format the prompt for DeepSeek AI for Korean immigration/police format
    prompt = f"""
    Güney Kore'ye aşağıdaki tercihlerimle bir seyahat planlıyorum:
    - Bütçe: {budget} USD
    - Seyahat Süresi: {data.get('duration', '7')} gün
    - Seyahat Tarzı: {data.get('travel_style', 'Moderate')}
    - İlgi Alanları: {', '.join(data.get('interests', ['Cultural']))}
    - Yemek Tercihleri: {data.get('food_preferences', 'Mix of Korean and international cuisine')}
    - Konaklama Türü: {data.get('accommodation', 'Mid-range Hotels')}
    - Seyahat Mevsimi/Ayı: {data.get('season', 'Spring')}
    
    Lütfen bana Güney Kore seyahatim için resmi bir seyahat planı oluştur. Bu plan Kore göçmenlik bürosu ya da polis tarafından incelendiğinde profesyonel ve resmi görünmelidir.
    
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
                "season": data.get('season', 'Spring')
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
            if row.strip() == '' or row.strip() == '---' or '---' in row:
                continue
                
            if '|' in row:
                cells = [cell.strip() for cell in row.split('|') if cell.strip()]
                is_header = 'Türkçe' in row or 'Korece' in row
                
                if is_header:
                    html.append('<tr>')
                    for cell in cells:
                        html.append(f'<th>{cell}</th>')
                    html.append('</tr>')
                else:
                    html.append('<tr>')
                    for cell in cells:
                        # Clean asterisks in cells
                        cleaned_cell = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', cell)
                        html.append(f'<td>{cleaned_cell}</td>')
                    html.append('</tr>')
            else:
                if len(html) > 0 and html[-1] == '</table></div>':
                    # Clean asterisks in text
                    cleaned_row = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', row)
                    html.append(f'<p class="mb-3">{cleaned_row}</p>')
                else:
                    if row.strip():
                        # Check if it's a heading (either standalone ** format or with :)
                        if (row.strip().startswith('**') and row.strip().endswith('**')) or row.strip().endswith(':'):
                            # Clean asterisks in headings
                            cleaned_heading = re.sub(r'\*\*([^*]+)\*\*', r'\1', row)
                            html.append(f'<h4 class="mt-4 mb-2">{cleaned_heading}</h4>')
                        else:
                            # Clean asterisks in paragraphs
                            cleaned_row = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', row)
                            html.append(f'<p class="mb-3">{cleaned_row}</p>')
        
        if len(html) > 0 and html[-1] != '</table></div>':
            html.append('</table></div>')
        
        # Add final disclaimer
        if "turistik amaçlıdır" in plan:
            disclaimer = re.search(r'(Bu seyahat planı turistik amaçlıdır.*)', plan)
            if disclaimer:
                html.append(f'<div class="alert alert-secondary mt-4">{disclaimer.group(1)}</div>')
        
        return '<div class="immigration-document">' + ''.join(html) + '</div>'
    else:
        # Use the regular plan formatter if not in table format
        return format_travel_plan(plan)

if __name__ == '__main__':
    # Use production settings
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False) 