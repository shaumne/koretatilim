// Global function to show planner section (accessed from HTML)
function showPlannerSection() {
    console.log("showPlannerSection çağrıldı");
    const plannerSection = document.getElementById('plannerSection');
    
    if (plannerSection) {
        // Force display style to block with !important
        plannerSection.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important;');
        plannerSection.scrollIntoView({ behavior: 'smooth' });
        console.log("plannerSection görünür hale getirildi");
    } else {
        console.error("plannerSection elementi bulunamadı!");
    }
}

// Manual step navigation - accessible globally
function gotoStep(stepNumber) {
    console.log("gotoStep function called for step:", stepNumber);
    
    // Hide all steps
    document.querySelectorAll('.step').forEach(step => {
        step.style.display = 'none';
    });
    
    // Show target step
    const targetStep = document.querySelector(`.step[data-step="${stepNumber}"]`);
    if (targetStep) {
        targetStep.style.display = 'block';
        
        // Update global currentStep variable if it exists
        if (typeof currentStep !== 'undefined') {
            window.currentStep = stepNumber;
        }
        
        // Update progress bar if functions exist
        if (typeof updateProgressBar === 'function') {
            updateProgressBar();
        }
        
        if (typeof updateProgressSteps === 'function') {
            updateProgressSteps(stepNumber);
        }
    } else {
        console.error(`Step ${stepNumber} not found`);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded event triggered");
    
    // Elements
    const tripForm = document.getElementById('tripForm');
    const steps = document.querySelectorAll('.step');
    const nextBtns = document.querySelectorAll('.next-btn');
    const prevBtns = document.querySelectorAll('.prev-btn');
    const progressBar = document.querySelector('.progress-bar');
    const resultsSection = document.getElementById('results');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const travelPlan = document.getElementById('travelPlan');
    const startOverBtn = document.getElementById('startOverBtn');
    const printPlanBtn = document.getElementById('printPlanBtn');
    const interestCheckboxes = document.querySelectorAll('.interest-check');
    
    // New elements
    const regularPlanTab = document.getElementById('regularPlanTab');
    const koreanPlanTab = document.getElementById('koreanPlanTab');
    const downloadPlanBtn = document.getElementById('downloadPlanBtn');
    const koreanPdfBtn = document.getElementById('koreanPdfBtn');
    const shareBtn = document.getElementById('shareBtn');
    const currencyInfo = document.getElementById('currencyInfo');
    const regularPlanBadge = document.getElementById('regularPlanBadge');
    const koreanPlanBadge = document.getElementById('koreanPlanBadge');
    const planCreationDate = document.getElementById('planCreationDate');
    
    // Welcome banner elements
    const startPlanningBtn = document.getElementById('startPlanningBtn');
    const plannerSection = document.getElementById('plannerSection');
    const budgetOptions = document.querySelectorAll('.budget-option');
    const customBudgetInput = document.getElementById('customBudget');
    const budgetInput = document.getElementById('budget');
    
    console.log("Elements initialized");
    
    // 'Planlamaya Başla' button clicked
    if (startPlanningBtn) {
        startPlanningBtn.addEventListener('click', function() {
            console.log("startPlanningBtn tıklandı");
            showPlannerSection();
        });
    }
    
    // Form option elements
    const interestOptions = document.querySelectorAll('.interest-option');
    const foodOptions = document.querySelectorAll('.food-option');
    const accommodationOptions = document.querySelectorAll('.accommodation-option');
    const seasonOptions = document.querySelectorAll('.season-option');
    const travelStyleOptions = document.querySelectorAll('.travel-style-option');
    
    // Summary elements
    const summaryBudget = document.getElementById('summaryBudget');
    const summaryDuration = document.getElementById('summaryDuration');
    const summaryStyle = document.getElementById('summaryStyle');
    const summarySeason = document.getElementById('summarySeason');
    
    // Summary pill elements
    const summaryBudgetPill = document.getElementById('summaryBudgetPill');
    const summaryDurationPill = document.getElementById('summaryDurationPill');
    const summarySeasonPill = document.getElementById('summarySeasonPill');
    const summaryStylePill = document.getElementById('summaryStylePill');
    const summaryFoodPill = document.getElementById('summaryFoodPill');
    const summaryAccommodationPill = document.getElementById('summaryAccommodationPill');

    let currentStep = 1;
    const totalSteps = steps.length;
    let formData = null;
    let regularPlanContent = '';
    let koreanPlanContent = '';
    let currentPlanType = 'regular';
    let exchangeRate = null;
    let planDate = '';

    // Initialize
    console.log("Starting to initialize modules");
    updateProgressBar();
    loadCurrencyRates();
    initWelcomeButtons();
    initBudgetOptions();
    initFormOptions();
    console.log("Modules initialization completed");
    
    // Load currency rates
    function loadCurrencyRates() {
        console.log("Döviz kurları yükleniyor...");
        
        // Use ExchangeRate-API (free version)
        fetch('https://open.er-api.com/v6/latest/USD')
            .then(response => {
                console.log("API yanıtı alındı:", response);
                return response.json();
            })
            .then(data => {
                console.log("API verileri:", data);
                if (data.rates && data.rates.KRW) {
                    exchangeRate = data.rates.KRW;
                    const formattedRate = new Intl.NumberFormat('ko-KR').format(exchangeRate);
                    const formattedDate = new Intl.DateTimeFormat('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    }).format(new Date());
                    
                    currencyInfo.innerHTML = `<i class="fas fa-dollar-sign me-1"></i> 1 USD = <strong>${formattedRate} KRW</strong> <small>(${formattedDate})</small>`;
                } else {
                    // Fallback to static rate if API fails
                    setStaticCurrencyRate();
                }
            })
            .catch(error => {
                console.error('Döviz kuru bilgisi alınamadı:', error);
                // Fallback to static rate if API fails
                setStaticCurrencyRate();
            });
    }
    
    // Set a static currency rate as fallback
    function setStaticCurrencyRate() {
        // Current static rate (as of 2023)
        const staticRate = 1324;
        exchangeRate = staticRate;
        
        const formattedRate = new Intl.NumberFormat('ko-KR').format(staticRate);
        const currentDate = new Intl.DateTimeFormat('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date());
        
        if (currencyInfo) {
            currencyInfo.innerHTML = `<i class="fas fa-dollar-sign me-1"></i> 1 USD = <strong>${formattedRate} KRW</strong> <small>(${currentDate} - tahmini)</small>`;
        }
    }
    
    // Initialize welcome banner buttons
    function initWelcomeButtons() {
        // Handle start planning button click
        if (startPlanningBtn) {
            console.log("startPlanningBtn bulundu");
            startPlanningBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log("startPlanningBtn tıklandı");
                showPlannerSection();
            });
        } else {
            console.error("startPlanningBtn bulunamadı");
        }
    }
    
    // Initialize Bootstrap tabs
    document.addEventListener('DOMContentLoaded', function() {
        // Enable Bootstrap tabs
        var tabElList = [].slice.call(document.querySelectorAll('button[data-bs-toggle="tab"]'));
        tabElList.forEach(function(tabEl) {
            new bootstrap.Tab(tabEl);
        });
    });
    
    // Initialize form options
    function initFormOptions() {
        // Interest options click event
        interestOptions.forEach(option => {
            option.addEventListener('click', function() {
                const checkbox = this.querySelector('.interest-check-input');
                this.classList.toggle('selected');
                checkbox.checked = this.classList.contains('selected');
                
                // Update interests feedback
                const checkedInterests = document.querySelectorAll('.interest-check-input:checked');
                const interestsFeedback = document.querySelector('.interests-feedback');
                if (interestsFeedback) {
                    interestsFeedback.style.display = checkedInterests.length === 0 ? 'block' : 'none';
                }
            });
        });
        
        // Food options click event
        foodOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Remove selected class from all options
                foodOptions.forEach(opt => opt.classList.remove('selected'));
                
                // Add selected class to clicked option
                this.classList.add('selected');
                
                // Update hidden input value
                const foodValue = this.getAttribute('data-food');
                const foodInput = document.getElementById('food_preferences');
                if (foodInput) {
                    foodInput.value = foodValue;
                }
                
                // Update summary pill
                if (summaryFoodPill) {
                    const foodLabel = this.querySelector('.food-details h5').textContent;
                    summaryFoodPill.textContent = foodLabel;
                    summaryFoodPill.style.display = 'inline-block';
                }
            });
        });
        
        // Accommodation options click event
        accommodationOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Remove selected class from all options
                accommodationOptions.forEach(opt => opt.classList.remove('selected'));
                
                // Add selected class to clicked option
                this.classList.add('selected');
                
                // Update hidden input value
                const accommodationValue = this.getAttribute('data-accommodation');
                const accommodationInput = document.getElementById('accommodation');
                if (accommodationInput) {
                    accommodationInput.value = accommodationValue;
                }
                
                // Update summary pill
                if (summaryAccommodationPill) {
                    const accommodationLabel = this.querySelector('.accommodation-name').textContent;
                    summaryAccommodationPill.textContent = accommodationLabel;
                    summaryAccommodationPill.style.display = 'inline-block';
                }
            });
        });
        
        // Season options click event
        seasonOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Remove selected class from all options
                seasonOptions.forEach(opt => opt.classList.remove('selected'));
                
                // Add selected class to clicked option
                this.classList.add('selected');
                
                // Update hidden input value
                const seasonValue = this.getAttribute('data-season');
                const seasonInput = document.getElementById('season');
                if (seasonInput) {
                    seasonInput.value = seasonValue;
                }
                
                // Update summary pill
                if (summarySeasonPill) {
                    const seasonLabel = this.querySelector('.season-info h5').textContent;
                    summarySeasonPill.textContent = seasonLabel;
                    summarySeasonPill.style.display = 'inline-block';
                }
            });
        });
        
        // Travel style options click event
        travelStyleOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Remove selected class from all options
                travelStyleOptions.forEach(opt => opt.classList.remove('selected'));
                
                // Add selected class to clicked option
                this.classList.add('selected');
                
                // Update hidden input value
                const styleValue = this.getAttribute('data-style');
                const styleInput = document.getElementById('travel_style');
                if (styleInput) {
                    styleInput.value = styleValue;
                }
                
                // Update summary pill
                if (summaryStylePill) {
                    const styleLabel = this.querySelector('.style-details h5').textContent;
                    summaryStylePill.textContent = styleLabel;
                    summaryStylePill.style.display = 'inline-block';
                }
            });
        });
    }
    
    // Initialize budget options
    function initBudgetOptions() {
        // Budget option selection
        budgetOptions.forEach(option => {
            option.addEventListener('click', function() {
                const budgetValue = this.getAttribute('data-budget');
                console.log("Bütçe seçeneği tıklandı (initBudgetOptions):", budgetValue);
                selectBudget(this, budgetValue);
            });
        });
        
        // Custom budget input
        customBudgetInput.addEventListener('input', function() {
            if (this.value) {
                console.log("Özel bütçe değeri (initBudgetOptions):", this.value);
                setCustomBudget(this.value);
            }
        });
        
        // Select default budget option initially
        const defaultOption = document.querySelector('.budget-option[data-budget="3000"]');
        if (defaultOption) {
            selectBudget(defaultOption, "3000");
        }
    }
    
    // Next button event
    nextBtns.forEach(button => {
        button.addEventListener('click', () => {
            // Validate current step
            const currentStepEl = document.querySelector(`.step[data-step="${currentStep}"]`);
            const inputs = currentStepEl.querySelectorAll('input, select');
            let isValid = true;
            
            inputs.forEach(input => {
                if (input.hasAttribute('required') && !input.value) {
                    input.classList.add('is-invalid');
                    isValid = false;
                } else {
                    input.classList.remove('is-invalid');
                }
            });
            
            // Special validation for interests (checkboxes)
            if (currentStep === 5) {
                const checkedInterests = document.querySelectorAll('.interest-check-input:checked');
                if (checkedInterests.length === 0) {
                    document.querySelector('.interests-feedback').style.display = 'block';
                    isValid = false;
                } else {
                    document.querySelector('.interests-feedback').style.display = 'none';
                }
            }
            
            if (isValid) {
                currentStep++;
                showStep(currentStep);
                updateProgressBar();
                updateProgressSteps(currentStep);
            }
        });
    });
    
    // Previous button event
    prevBtns.forEach(button => {
        button.addEventListener('click', () => {
            currentStep--;
            showStep(currentStep);
            updateProgressBar();
            updateProgressSteps(currentStep);
        });
    });
    
    // Show specific step
    function showStep(stepNumber) {
        steps.forEach(step => {
            step.style.display = 'none';
        });
        document.querySelector(`.step[data-step="${stepNumber}"]`).style.display = 'block';
    }
    
    // Update progress bar
    function updateProgressBar() {
        const progressPercentage = (currentStep / totalSteps) * 100;
        progressBar.style.width = `${progressPercentage}%`;
        progressBar.setAttribute('aria-valuenow', progressPercentage);
    }
    
    // Toggle between regular and Korean plan
    if (regularPlanTab) {
        regularPlanTab.addEventListener('click', function() {
            // Bootstrap tab functionality will handle the display
        });
    }
    
    if (koreanPlanTab) {
        koreanPlanTab.addEventListener('click', function() {
            // Load Korean plan content if not already loaded
            if (!koreanPlanContent && !document.querySelector('#koreanPlanContent .loading-container')) {
                // Show loading in Korean tab
                const koreanTabContent = document.getElementById('koreanPlanContent');
                showLoadingAnimation('Korece plan hazırlanıyor...', 'Lütfen bekleyin, belge hazırlanıyor', koreanTabContent);
                
                fetch('/generate_korean_plan', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                })
                .then(response => response.json())
                .then(responseData => {
                    console.log("Received response:", responseData);
                    
                    if (responseData.success) {
                        // Update UI with plan
                        const travelPlan = document.getElementById('travelPlan');
                        if (travelPlan) {
                            // Hide loading spinner and animation
                            const loadingSpinner = document.getElementById('loadingSpinner');
                            const koreaLoadingAnimation = document.getElementById('koreaLoadingAnimation');
                            
                            if (loadingSpinner) {
                                loadingSpinner.style.display = 'none';
                            }
                            
                            if (koreaLoadingAnimation) {
                                koreaLoadingAnimation.style.display = 'none';
                            }
                            
                            // Display formatted plan
                            travelPlan.innerHTML = responseData.plan;
                            travelPlan.style.display = 'block';
                            
                            // Update summary if available
                            if (responseData.summary) {
                                updateSummary(responseData);
                            }
                        }
                    } else {
                        console.error("Error from server:", responseData.error);
                        showError("Plan oluşturulamadı", responseData.error || "Beklenmeyen bir hata oluştu.");
                    }
                })
                .catch(error => {
                    hideLoadingAnimation();
                    showError("İstek sırasında bir hata oluştu", error.message);
                });
            }
        });
    }
    
    function showRegularPlan() {
        // No longer needed with Bootstrap tabs
        // Left for backward compatibility
        currentPlanType = 'regular';
    }
    
    function showKoreanPlan() {
        // No longer needed with Bootstrap tabs
        // Left for backward compatibility
        currentPlanType = 'korean';
    }
    
    // Show enhanced loading animation
    function showLoadingAnimation(message, subtitle, container = null) {
        const targetContainer = container || travelPlan;
        
        if (targetContainer) {
            targetContainer.style.display = 'none';
        }
        loadingSpinner.style.display = 'none';
        
        // Create loading container
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'loading-container';
        loadingContainer.id = 'loadingContainer';
        
        // Loading animation with icon and message
        loadingContainer.innerHTML = `
            <div class="loading-icon"></div>
            <div class="loading-text">${message || 'Planınız hazırlanıyor...'}</div>
            ${subtitle ? `<div class="loading-subtitle">${subtitle}</div>` : ''}
        `;
        
        // Add loading animation tips that cycle every few seconds
        const loadingTips = document.createElement('div');
        loadingTips.className = 'loading-subtitle mt-4';
        loadingTips.id = 'loadingTips';
        loadingContainer.appendChild(loadingTips);
        
        // Insert loading container to result section
        const resultCardBody = document.querySelector('.result-card .card-body');
        resultCardBody.insertBefore(loadingContainer, container || travelPlan);
        
        // Start loading tips rotation
        startLoadingTips();
    }
    
    // Hide enhanced loading animation
    function hideLoadingAnimation() {
        const loadingContainer = document.getElementById('loadingContainer');
        if (loadingContainer) {
            loadingContainer.remove();
        }
        stopLoadingTips();
    }
    
    // Loading tips rotation
    let tipsInterval;
    const tips = [
        "Kore turu için vize almanız en az 2 hafta sürer.",
        "Seul'de gezilecek en iyi alanlar Hongdae ve Gangnam bölgeleridir.",
        "Korece 'Annyeonghaseyo' (안녕하세요) merhaba demektir.",
        "K-Food aşıkları için Kimchi ve Bibimbap mutlaka denenmeli.",
        "Kore'de toplu ulaşım için T-Money kartı edinebilirsiniz.",
        "Kore döviz olarak Kore Wonu (₩) kullanır.",
        "N Seoul Tower, Seul'ün en yüksek binasıdır ve muhteşem bir manzaraya sahiptir.",
        "Kore'de yürüyen merdivenlerde sağda durup soldan geçilir.",
        "Metroda yaşlılara yer vermek Kore'de önemli bir görgü kuralıdır."
    ];
    
    function startLoadingTips() {
        const tipElement = document.getElementById('loadingTips');
        let tipIndex = 0;
        
        // Set initial tip
        tipElement.textContent = tips[tipIndex];
        tipElement.style.opacity = 1;
        
        // Rotate tips every 4 seconds
        tipsInterval = setInterval(() => {
            // Fade out
            tipElement.style.opacity = 0;
            
            setTimeout(() => {
                // Change tip and fade in
                tipIndex = (tipIndex + 1) % tips.length;
                tipElement.textContent = tips[tipIndex];
                tipElement.style.opacity = 1;
            }, 500);
        }, 4000);
    }
    
    function stopLoadingTips() {
        if (tipsInterval) {
            clearInterval(tipsInterval);
            tipsInterval = null;
        }
    }
    
    // Show error in travel plan
    function showError(title, message, container = null) {
        const resultsSection = document.getElementById('results');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const koreaLoadingAnimation = document.getElementById('koreaLoadingAnimation');
        const travelPlan = document.getElementById('travelPlan');
        
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
        
        if (koreaLoadingAnimation) {
            koreaLoadingAnimation.style.display = 'none';
        }
        
        hideLoadingAnimation();
        const targetContainer = container || travelPlan;
        targetContainer.innerHTML = `
            <div class="alert alert-danger">
                <h4 class="alert-heading">${title}</h4>
                <p>${message}</p>
                <hr>
                <p class="mb-0">Lütfen tekrar deneyin veya farklı tercihlerle yeniden başlayın.</p>
            </div>
        `;
        targetContainer.style.display = 'block';
    }
    
    // PDF Download functionality
    downloadPlanBtn.addEventListener('click', function() {
        generatePDF(false);
    });
    
    // Korean PDF functionality
    koreanPdfBtn.addEventListener('click', function() {
        if (!koreanPlanContent) {
            // Load Korean plan first
            const koreanTabContent = document.getElementById('koreanPlanContent');
            showLoadingAnimation('Korece plan hazırlanıyor...', 'Lütfen bekleyin, belge hazırlanıyor', koreanTabContent);
            
            fetch('/generate_korean_plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            })
            .then(response => response.json())
            .then(data => {
                hideLoadingAnimation();
                
                if (data.success) {
                    koreanPlanContent = formatKoreanPlan(data.plan);
                    document.getElementById('koreanPlanContent').innerHTML = koreanPlanContent;
                    generatePDF(true);
                } else {
                    showError('Korece plan oluşturulamadı', data.error, document.getElementById('koreanPlanContent'));
                }
            })
            .catch(error => {
                hideLoadingAnimation();
                showError('İstek sırasında bir hata oluştu', error.message, document.getElementById('koreanPlanContent'));
            });
        } else {
            generatePDF(true);
        }
    });
    
    function generatePDF(isKorean = false) {
        console.log("Generating PDF", isKorean ? "for Korean plan" : "for regular plan");
        
        // Determine content to convert
        const planContentElement = isKorean ? 
            document.getElementById('koreanPlanContent') : 
            document.getElementById('travelPlan');
        
        // Return if no content
        if (!planContentElement) {
            console.error("No plan content found for PDF generation");
            return;
        }

        // Prepare PDF options
        const filename = isKorean ? 'kore-gocmenlik-plani.pdf' : 'kore-seyahat-plani.pdf';
        
        // Clone the element to avoid modifying the original content
        const clonedElement = planContentElement.cloneNode(true);
        
        // Add header with summary data
        const headerHTML = createPDFHeader();
        
        // Create a wrapper div
        const pdfContent = document.createElement('div');
        pdfContent.classList.add('pdf-content');
        pdfContent.innerHTML = headerHTML;
        pdfContent.appendChild(clonedElement);
        
        // PDF configuration
        const pdfOptions = {
            margin: 10,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        // Show loading message
        showLoadingAnimation("PDF hazırlanıyor...", "Bu işlem biraz zaman alabilir, lütfen bekleyin.");
        
        // Generate PDF
        html2pdf()
            .set(pdfOptions)
            .from(pdfContent)
            .save()
            .then(() => {
                // Success
                console.log("PDF creation successful");
                hideLoadingAnimation();
            })
            .catch(error => {
                // Error handling
                console.error("PDF creation error:", error);
                hideLoadingAnimation();
                showError("PDF oluşturma hatası", "PDF oluşturulurken bir hata meydana geldi. Lütfen tekrar deneyin.");
            });
    }
    
    // Helper function to create PDF header
    function createPDFHeader() {
        // Get summary data
        const budget = document.getElementById('summaryBudget').textContent;
        const duration = document.getElementById('summaryDuration').textContent;
        const style = document.getElementById('summaryStyle').textContent;
        const season = document.getElementById('summarySeason').textContent;
        const date = document.getElementById('planCreationDate').textContent;
        
        // Create header HTML
        return `
            <div class="pdf-header" style="margin-bottom: 20px; border-bottom: 1px solid #dee2e6; padding-bottom: 15px;">
                <h1 style="font-size: 24px; margin-bottom: 10px; color: #5f27cd;">Kore Seyahat Planı</h1>
                <p style="margin-bottom: 5px; font-size: 12px;">${date}</p>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px;">
                    <div style="flex: 1; min-width: 120px; background: #f8f9fa; padding: 8px; border-radius: 5px;">
                        <div style="font-weight: bold; font-size: 12px;">Bütçe</div>
                        <div style="font-size: 14px;">${budget}</div>
                    </div>
                    <div style="flex: 1; min-width: 120px; background: #f8f9fa; padding: 8px; border-radius: 5px;">
                        <div style="font-weight: bold; font-size: 12px;">Süre</div>
                        <div style="font-size: 14px;">${duration}</div>
                    </div>
                    <div style="flex: 1; min-width: 120px; background: #f8f9fa; padding: 8px; border-radius: 5px;">
                        <div style="font-weight: bold; font-size: 12px;">Tarz</div>
                        <div style="font-size: 14px;">${style}</div>
                    </div>
                    <div style="flex: 1; min-width: 120px; background: #f8f9fa; padding: 8px; border-radius: 5px;">
                        <div style="font-weight: bold; font-size: 12px;">Mevsim</div>
                        <div style="font-size: 14px;">${season}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Share functionality
    shareBtn.addEventListener('click', function() {
        const title = 'Kore Seyahat Planım';
        const text = 'Güney Kore seyahat planımı sizinle paylaşmak istiyorum!';
        const url = window.location.href;
        
        if (navigator.share) {
            navigator.share({
                title: title,
                text: text,
                url: url,
            }).then(() => {
                console.log('Paylaşım başarılı');
            }).catch((error) => {
                console.error('Paylaşım hatası:', error);
                shareFallback();
            });
        } else {
            shareFallback();
        }
    });
    
    function shareFallback() {
        // URL'yi panoya kopyala
        const dummy = document.createElement('textarea');
        document.body.appendChild(dummy);
        dummy.value = window.location.href;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        
        // Kullanıcıya bildir
        alert('Site linki panoya kopyalandı. Dilediğiniz yerde paylaşabilirsiniz.');
    }
    
    // Update summary values
    function updateSummary(data) {
        console.log("Updating summary with data:", data);
        
        // Update summary in results section
        const summaryBudget = document.getElementById('summaryBudget');
        const summaryDuration = document.getElementById('summaryDuration');
        const summaryStyle = document.getElementById('summaryStyle');
        const summarySeason = document.getElementById('summarySeason');
        const planCreationDate = document.getElementById('planCreationDate');
        
        if (data.summary) {
            // Make sure to use the actual budget value from form data, not a hardcoded value
            if (summaryBudget) summaryBudget.textContent = `$${data.summary.budget}`;
            if (summaryDuration) summaryDuration.textContent = `${data.summary.duration} gün`;
            
            if (summaryStyle) {
                let styleText = data.summary.style;
                switch (data.summary.style) {
                    case 'Luxury': styleText = 'Lüks'; break;
                    case 'Moderate': styleText = 'Orta Seviye'; break;
                    case 'Budget': styleText = 'Ekonomik'; break;
                    case 'Backpacking': styleText = 'Sırt Çantalı'; break;
                }
                summaryStyle.textContent = styleText;
            }
            
            if (summarySeason) {
                let seasonText = data.summary.season;
                if (seasonText.includes('Spring')) seasonText = 'İlkbahar';
                else if (seasonText.includes('Summer')) seasonText = 'Yaz';
                else if (seasonText.includes('Fall')) seasonText = 'Sonbahar';
                else if (seasonText.includes('Winter')) seasonText = 'Kış';
                summarySeason.textContent = seasonText;
            }
        }
        
        if (planCreationDate) {
            planCreationDate.textContent = `Plan oluşturulma tarihi: ${data.date || new Date().toLocaleDateString('tr-TR')}`;
        }
    }
    
    // Update progress steps visual indicators
    function updateProgressSteps(currentStep) {
        const progressSteps = document.querySelectorAll('.progress-step');
        const progressLines = document.querySelectorAll('.progress-line');
        
        progressSteps.forEach((step, index) => {
            // Convert from 1-based to 0-based indexing
            const stepNumber = index + 1;
            
            // Reset all steps
            step.classList.remove('active', 'completed');
            step.querySelector('.step-icon').classList.remove('active', 'completed');
            
            // Mark completed steps
            if (stepNumber < currentStep) {
                step.classList.add('completed');
                step.querySelector('.step-icon').classList.add('completed');
                step.querySelector('.step-icon').innerHTML = '<i class="fas fa-check"></i>';
            } 
            // Mark active step
            else if (stepNumber === currentStep) {
                step.classList.add('active');
                step.querySelector('.step-icon').classList.add('active');
                step.querySelector('.step-icon').innerHTML = stepNumber;
            } 
            // Reset future steps
            else {
                step.querySelector('.step-icon').innerHTML = stepNumber;
            }
        });
        
        // Update progress lines
        progressLines.forEach((line, index) => {
            // Reset all lines
            line.classList.remove('active');
            
            // Mark completed lines (those before the current step)
            if (index < currentStep - 1) {
                line.classList.add('active');
            }
        });
    }

    // Format travel plan content
    function formatTravelPlan(plan) {
        console.log("Formatting travel plan:", plan.substring(0, 100) + "...");
        
        // Check if plan is empty or undefined
        if (!plan || typeof plan !== 'string') {
            console.error("Invalid plan data received:", plan);
            return '<div class="alert alert-danger">Geçersiz plan verisi alındı. Lütfen tekrar deneyin.</div>';
        }
        
        // Update dates from 2023 to 2025
        plan = plan.replace(/\b2023\b/g, '2025');
        
        try {
            // First handle horizontal lines (before lists to prevent conflicts)
            plan = plan.replace(/^---$/gm, '<hr class="my-4">');
            
            // First pass for major headings
            // Handle the title at top of document which typically is wrapped in ** ** but on its own line
            plan = plan.replace(/^\*\*([^*\n]+)\*\*$/gm, '<h2 class="plan-title mt-4 mb-3">$1</h2>');
            
            // Parse sections with Markdown-style headers
            plan = plan.replace(/^### \*\*([^*]+)\*\*$/gm, '<h4 class="mt-4 mb-2 travel-day-heading">$1</h4>');
            plan = plan.replace(/^### (.+)$/gm, '<h4 class="mt-4 mb-2 travel-day-heading">$1</h4>');
            plan = plan.replace(/^## (.+)$/gm, '<h3 class="mt-4 mb-2">$1</h3>');
            plan = plan.replace(/^# (.+)$/gm, '<h2 class="mt-4 mb-3">$1</h2>');
            
            // Handle bold text that isn't part of headers (do this after headers to avoid conflicts)
            plan = plan.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
            
            // Handle lists with proper indentation and structure
            plan = plan.replace(/^- (.+)$/gm, '<li>$1</li>');
            // Find consecutive li elements and wrap them in ul
            let matches = [...plan.matchAll(/(?:<li>.+<\/li>\s*)+/g)];
            for (let match of matches) {
                const matchedText = match[0];
                const wrappedText = `<ul class="mb-3">${matchedText}</ul>`;
                plan = plan.replace(matchedText, wrappedText);
            }
            
            // Handle numbered lists
            plan = plan.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
            // Find consecutive li elements and wrap them in ol
            matches = [...plan.matchAll(/(?:<li>.+<\/li>\s*)+/g)];
            for (let match of matches) {
                const matchedText = match[0];
                if (!matchedText.includes('<ul')) { // Don't re-wrap lists already in ul
                    const wrappedText = `<ol class="mb-3">${matchedText}</ol>`;
                    plan = plan.replace(matchedText, wrappedText);
                }
            }
            
            // Handle plain paragraphs with better spacing
            // Split by double newlines to identify potential paragraphs
            const paragraphs = plan.split(/\n\s*\n/);
            plan = paragraphs.map(p => {
                p = p.trim();
                if (!p) return '';
                
                // Skip already formatted HTML elements
                if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<ol') || 
                    p.startsWith('<hr') || p.startsWith('<div') || p.startsWith('<p')) {
                    return p;
                }
                
                // Wrap in paragraph tags
                return `<p class="mb-3">${p}</p>`;
            }).join('\n\n');
            
            // Add highlighting to important information
            plan = plan.replace(/(\d+\. Gün:|Gün \d+:)/g, '<strong class="text-primary heading-day">$1</strong>');
            
            // Highlight categories
            const categories = [
                'Konaklama', 'Yemek', 'Aktivite', 'Ulaşım', 'Tur', 'Sabah', 'Öğle', 
                'Akşam', 'Öğle Yemeği', 'Akşam Yemeği', 'Kahvaltı', 'Öğleden Sonra'
            ];
            
            // Create the regex pattern for categories
            const categoryPattern = categories.map(cat => `\\*\\*${cat}:\\*\\*`).join('|');
            plan = plan.replace(new RegExp(`(${categoryPattern})`, 'g'), 
                           '<strong class="category-heading">$1</strong>');
            
            // Highlight costs and budgets
            const costPattern = ['\\*\\*Maliyet:\\*\\*', '\\*\\*Bütçe:\\*\\*', '\\*\\*Tahmini Maliyet:\\*\\*', 
                            '\\*\\*Günlük Maliyet:\\*\\*', '\\*\\*Toplam Maliyet:\\*\\*', 
                            '\\*\\*Toplam Tahmini Maliyet:\\*\\*'].join('|');
            plan = plan.replace(new RegExp(`(${costPattern})`, 'g'), 
                           '<strong class="text-success category-heading">$1</strong>');
            
            // Add tip highlights with better styling
            const tipPattern = ['\\*\\*İpucu:\\*\\*', '\\*\\*Uyarı:\\*\\*', '\\*\\*İletişim:\\*\\*', 
                           '\\*\\*Ekstra İpuçları:\\*\\*', '\\*\\*Temel Korece:\\*\\*', 
                           '\\*\\*Genel İpuçları:\\*\\*', '\\*\\*Not:\\*\\*'].join('|');
            plan = plan.replace(new RegExp(`(${tipPattern})([^<]*)`, 'g'), 
                           '<div class="alert alert-info tip-box"><strong class="tip-heading">$1</strong>$2</div>');
            
            // Format Korean phrases with better styling
            plan = plan.replace(/([가-힣\s]+)(\s*[-–—:]\s*)([^<\r\n]+)/g, 
                           '<span class="badge bg-light text-dark me-1 korean-phrase">$1</span> $3');
            
            // Clean up any duplicate wrapping that might have occurred
            plan = plan.replace(/<p>\s*<(h\d|ul|ol|div)[^>]*>/g, '<$1>');
            plan = plan.replace(/<\/(h\d|ul|ol|div)>\s*<\/p>/g, '</$1>');
            
            // Format dollar amounts
            plan = plan.replace(/(\$\d+(?:,\d+)*(?:\.\d+)?)/g, '<span class="text-success">$1</span>');
            
            // Enhance the overall sections
            plan = '<div class="travel-plan">' + plan + '</div>';
            
            console.log("Format completed successfully");
            return plan;
        } catch (e) {
            console.error("Error formatting travel plan:", e);
            // Return original plan with minimal formatting if error occurs
            return '<div class="travel-plan"><pre class="p-3 bg-light">' + 
                   plan.replace(/</g, '&lt;').replace(/>/g, '&gt;') + 
                   '</pre></div>';
        }
    }
    
    // Format Korean plan for immigration
    function formatKoreanPlan(plan) {
        // Check if the plan has a table-like format
        if (plan.includes('|')) {
            // It might be in a markdown table format, convert to HTML table
            const rows = plan.split('\n').filter(row => row.trim() !== '');
            let inTable = false;
            let tableHTML = '<div class="table-responsive"><table class="korean-plan-table">';
            
            rows.forEach(row => {
                if (row.includes('|')) {
                    inTable = true;
                    const cells = row.split('|').filter(cell => cell.trim() !== '');
                    
                    if (row.includes('---')) {
                        // This is a separator row in markdown tables, skip
                        return;
                    }
                    
                    const isHeader = row.includes('Türkçe') || row.includes('Korece');
                    
                    tableHTML += '<tr>';
                    cells.forEach(cell => {
                        if (isHeader) {
                            tableHTML += `<th>${cell.trim()}</th>`;
                        } else {
                            tableHTML += `<td>${cell.trim()}</td>`;
                        }
                    });
                    tableHTML += '</tr>';
                } else if (inTable) {
                    inTable = false;
                    tableHTML += '</table></div>';
                    tableHTML += `<p>${row}</p>`;
                } else {
                    tableHTML += `<p>${row}</p>`;
                }
            });
            
            // If we're still in table mode, close the table
            if (inTable) {
                tableHTML += '</table></div>';
            }
            
            return tableHTML;
        } else {
            // Format non-table content
            return formatTravelPlan(plan);
        }
    }
    
    // Restart the planning process
    startOverBtn.addEventListener('click', function() {
        currentStep = 1;
        showStep(currentStep);
        updateProgressBar();
        
        // Clear form fields
        tripForm.reset();
        
        // Hide results section
        resultsSection.style.display = 'none';
        
        // Scroll to top of form
        tripForm.scrollIntoView({ behavior: 'smooth' });
    });
    
    // Print functionality
    printPlanBtn.addEventListener('click', function() {
        window.print();
    });

    // Process trip form submission
    if (tripForm) {
        tripForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Debug logging for budget value
            const budgetInput = document.getElementById('budget');
            console.log("Form submitted, budget value before processing:", budgetInput ? budgetInput.value : "not found");
            
            // Collect form data
            const formData = new FormData(tripForm);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                data[key] = value;
                console.log(`Form data: ${key} = ${value}`);
            }
            
            // Handle interests (checkboxes)
            data.interests = [];
            document.querySelectorAll('.interest-check-input:checked').forEach(checkbox => {
                data.interests.push(checkbox.value);
                console.log(`Selected interest: ${checkbox.value}`);
            });
            
            // Show loading animation
            showLoadingAnimation('Kore Tatil Planınız Hazırlanıyor...', 'Yapay zeka destekli sistemimiz kişiselleştirilmiş tatil rotanızı oluşturuyor');
            startLoadingTips();
            
            console.log("Sending data to backend:", data);
            
            // Send data to backend
            fetch('/generate_plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                hideLoadingAnimation();
                stopLoadingTips();
                
                if (data.success) {
                    console.log("Plan successfully generated, formatting results");
                    formData = data;
                    regularPlanContent = formatTravelPlan(data.plan);
                    planDate = data.date;
                    
                    // Show results
                    resultsSection.style.display = 'block';
                    travelPlan.innerHTML = regularPlanContent;
                    
                    // Also update the regularPlanContent div
                    const regularPlanContentDiv = document.getElementById('regularPlanContent');
                    if (regularPlanContentDiv && regularPlanContentDiv !== travelPlan.parentNode) {
                        regularPlanContentDiv.innerHTML = '<div class="travel-plan-content">' + regularPlanContent + '</div>';
                    }
                    
                    // Update summary
                    updateSummary(data.summary);
                    
                    // Set date
                    if (planCreationDate) {
                        planCreationDate.textContent = planDate;
                    }
                    
                    // Scroll to results
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                } else {
                    showError('Plan oluşturulamadı', data.error);
                }
            })
            .catch(error => {
                hideLoadingAnimation();
                stopLoadingTips();
                showError('İstek sırasında bir hata oluştu', error.message);
            });
        });
    }

    // Global functions for duration selection
    function selectDuration(element, value) {
        console.log("Duration seçildi:", value);
        
        // Remove selected class from all options
        document.querySelectorAll('.duration-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        element.classList.add('selected');
        
        // Update hidden input
        const durationInput = document.getElementById('duration');
        if (durationInput) {
            durationInput.value = value;
        }
        
        // Update summary pill if exists
        const summaryDurationPill = document.getElementById('summaryDurationPill');
        if (summaryDurationPill) {
            summaryDurationPill.textContent = `${value} gün`;
            summaryDurationPill.style.display = 'inline-block';
        }
        
        // Clear custom duration input if exists
        const customDurationInput = document.getElementById('customDuration');
        if (customDurationInput) {
            customDurationInput.value = '';
        }
    }

    function activateCustomDuration(element) {
        console.log("Custom duration aktifleştirildi");
        
        // Remove selected class from all options
        document.querySelectorAll('.duration-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Add selected class to custom option
        element.classList.add('selected');
        
        // Focus on custom input
        const customDurationInput = document.getElementById('customDuration');
        if (customDurationInput) {
            customDurationInput.focus();
        }
    }

    function setCustomDuration(value) {
        if (value && Number(value) > 0) {
            console.log("Custom duration ayarlandı:", value);
            
            // Update hidden input
            const durationInput = document.getElementById('duration');
            if (durationInput) {
                durationInput.value = value;
            }
            
            // Update summary pill if exists
            const summaryDurationPill = document.getElementById('summaryDurationPill');
            if (summaryDurationPill) {
                summaryDurationPill.textContent = `${value} gün`;
                summaryDurationPill.style.display = 'inline-block';
            }
        }
    }

    // Global budget selection function
    function selectBudget(element, value) {
        console.log("Budget seçildi:", value);
        
        // Remove selected class from all options
        document.querySelectorAll('.budget-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        element.classList.add('selected');
        
        // Update hidden input
        const budgetInput = document.getElementById('budget');
        if (budgetInput) {
            budgetInput.value = value;
            console.log("Budget input value updated to:", value);
        }
        
        // Update summary pill
        const summaryBudgetPill = document.getElementById('summaryBudgetPill');
        if (summaryBudgetPill) {
            summaryBudgetPill.textContent = `$${value}`;
            summaryBudgetPill.style.display = 'inline-block';
        }
        
        // Clear custom budget input if exists
        const customBudgetInput = document.getElementById('customBudget');
        if (customBudgetInput) {
            customBudgetInput.value = '';
        }
    }

    // Global custom budget function
    function setCustomBudget(value) {
        console.log("Custom budget handling:", value);
        
        if (value && Number(value) > 0) {
            // Update hidden input value
            const budgetInput = document.getElementById('budget');
            if (budgetInput) {
                budgetInput.value = value;
                console.log("Budget input value updated to custom:", value);
            }
            
            // Update summary pill
            const summaryBudgetPill = document.getElementById('summaryBudgetPill');
            if (summaryBudgetPill) {
                summaryBudgetPill.textContent = `$${value}`;
                summaryBudgetPill.style.display = 'inline-block';
            }
        }
    }

    // Global food selection function
    function selectFood(element, value) {
        console.log("Yemek seçildi:", value);
        
        // Remove selected class from all options
        document.querySelectorAll('.food-option').forEach(opt => opt.classList.remove('selected'));
        
        // Add selected class to clicked option
        element.classList.add('selected');
        
        // Update hidden input value
        const foodInput = document.getElementById('food_preferences');
        if (foodInput) {
            foodInput.value = value;
        }
        
        // Update summary pill
        const summaryFoodPill = document.getElementById('summaryFoodPill');
        if (summaryFoodPill) {
            const foodLabel = element.querySelector('.food-details h5').textContent;
            summaryFoodPill.textContent = foodLabel;
            summaryFoodPill.style.display = 'inline-block';
        }
    }

    // Global accommodation selection function
    function selectAccommodation(element, value) {
        console.log("Konaklama seçildi:", value);
        
        // Remove selected class from all options
        document.querySelectorAll('.accommodation-option').forEach(opt => opt.classList.remove('selected'));
        
        // Add selected class to clicked option
        element.classList.add('selected');
        
        // Update hidden input value
        const accommodationInput = document.getElementById('accommodation');
        if (accommodationInput) {
            accommodationInput.value = value;
        }
        
        // Update summary pill
        const summaryAccommodationPill = document.getElementById('summaryAccommodationPill');
        if (summaryAccommodationPill) {
            const accommodationLabel = element.querySelector('.accommodation-name').textContent;
            summaryAccommodationPill.textContent = accommodationLabel;
            summaryAccommodationPill.style.display = 'inline-block';
        }
    }
}); 