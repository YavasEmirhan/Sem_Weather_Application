const apiKey = '9784778c5208d29ef82a11ed069a8d40'; // OpenWeatherMap API anahtarınızı buraya ekleyin
const newsApiKey = '25af0fdb64bd45f1928af4f6497e9af0'; // NewsAPI anahtarınızı buraya ekleyin
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const forecastButton = document.getElementById('forecast-button');
const mapButton = document.getElementById('map-button');
const roadRiskButton = document.getElementById('road-risk-button');
const newsButton = document.getElementById('news-button');
const historicalButton = document.getElementById('historical-button');
const forecastBox = document.getElementById('forecast-box');
const mapBox = document.getElementById('map-box');
const roadRiskBox = document.getElementById('road-risk-box');
const newsBox = document.getElementById('news-box');
const historicalBox = document.getElementById('historical-box');
const historicalDate = document.getElementById('historical-date');
const getHistoricalData = document.getElementById('get-historical-data');
const historicalData = document.getElementById('historical-data');
const cityElement = document.getElementById('city');
const tempElement = document.getElementById('temperature');
const descElement = document.getElementById('description');
const humidityElement = document.getElementById('humidity');
const windElement = document.getElementById('wind-speed');
const weatherIcon = document.getElementById('weather-icon');
const forecastContainer = document.getElementById('forecast-container');
const newsContainer = document.getElementById('news-container');

let currentCity = 'Istanbul';
let currentCountry = 'TR';
let map = null;
let roadMap = null;
let markers = [];
let roadMarkers = [];
let newsCache = null;
let newsCacheTime = null;

async function getWeatherData(city) {
    try {
        // Anlık hava durumu verisi
        const currentResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&lang=tr&appid=${apiKey}`);

        if (!currentResponse.ok) {
            throw new Error('Şehir bulunamadı');
        }

        const currentData = await currentResponse.json();
        currentCity = city;
        currentCountry = currentData.sys.country;

        // Anlık verileri güncelle
        cityElement.textContent = currentData.name;
        tempElement.textContent = `${Math.round(currentData.main.temp)}°C`;
        descElement.textContent = currentData.weather[0].description;
        humidityElement.textContent = `${currentData.main.humidity}%`;
        windElement.textContent = `${currentData.wind.speed} km/s`;
        weatherIcon.src = `https://openweathermap.org/img/wn/${currentData.weather[0].icon}@2x.png`;

        // Tüm bölümleri gizle
        forecastBox.style.display = 'none';
        mapBox.style.display = 'none';
        roadRiskBox.style.display = 'none';
        newsBox.style.display = 'none';

        // Tüm buton yazılarını sıfırla
        forecastButton.textContent = '7 Günlük Tahmin Göster';
        mapButton.textContent = 'Ülke Haritasını Göster';
        roadRiskButton.textContent = 'Yol Risklerini Göster';
        newsButton.textContent = 'Hava Durumu Haberlerini Göster';

    } catch (error) {
        alert('Hava durumu bilgisi alınamadı: ' + error.message);
    }
}

async function getForecastData() {
    try {
        // Önce şehrin koordinatlarını al
        const currentResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${currentCity}&units=metric&lang=tr&appid=${apiKey}`);
        const currentData = await currentResponse.json();

        // Koordinatları kullanarak tahmin verisini al
        const forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${currentData.coord.lat}&lon=${currentData.coord.lon}&units=metric&lang=tr&appid=${apiKey}`);
        const forecastData = await forecastResponse.json();

        // Tahmin verilerini güncelle
        updateForecast(forecastData.list);

    } catch (error) {
        alert('Tahmin bilgisi alınamadı: ' + error.message);
    }
}

async function getCountryCities() {
    try {
        // Ülke sınırları içindeki şehirleri bulmak için sınır koordinatları
        const boundingBoxes = {
            'TR': { min_lat: 36, max_lat: 42, min_lon: 26, max_lon: 45 }, // Türkiye
            'DE': { min_lat: 47, max_lat: 55, min_lon: 5, max_lon: 15 },  // Almanya
            'FR': { min_lat: 41, max_lat: 51, min_lon: -5, max_lon: 10 }, // Fransa
            // Diğer ülkeler için buraya eklenebilir
        };

        const box = boundingBoxes[currentCountry] || { min_lat: -90, max_lat: 90, min_lon: -180, max_lon: 180 };

        // Ülke sınırları içindeki şehirleri al
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/box/city?bbox=${box.min_lon},${box.min_lat},${box.max_lon},${box.max_lat},50&units=metric&lang=tr&appid=${apiKey}`
        );

        if (!response.ok) {
            throw new Error('Şehir verileri alınamadı');
        }

        const data = await response.json();
        return data.list.filter(city => city.sys.country === currentCountry);
    } catch (error) {
        console.error('Şehir listesi alınamadı:', error);
        return [];
    }
}

async function initMap() {
    try {
        // Mevcut şehrin konumunu al
        const cityResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${currentCity}&units=metric&lang=tr&appid=${apiKey}`);
        const cityData = await cityResponse.json();

        if (!map) {
            // Haritayı başlat
            map = L.map('weather-map', {
                minZoom: 5,
                maxZoom: 10,
                zoomControl: true
            });

            // OpenWeatherMap harita katmanları
            const baseLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            });

            const temperatureLayer = L.tileLayer(`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${apiKey}`, {
                attribution: 'Weather data © OpenWeatherMap'
            });

            const precipitationLayer = L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`, {
                attribution: 'Weather data © OpenWeatherMap'
            });

            const cloudsLayer = L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${apiKey}`, {
                attribution: 'Weather data © OpenWeatherMap'
            });

            // Katmanları haritaya ekle
            baseLayer.addTo(map);
            temperatureLayer.addTo(map);

            // Katman kontrolü ekle
            const overlayMaps = {
                "Sıcaklık": temperatureLayer,
                "Yağış": precipitationLayer,
                "Bulut": cloudsLayer
            };

            L.control.layers(null, overlayMaps, {
                collapsed: false,
                position: 'topright'
            }).addTo(map);
        }

        // Önceki işaretleyicileri temizle
        markers.forEach(marker => marker.remove());
        markers = [];

        // Ülkedeki diğer şehirleri al
        const cities = await getCountryCities();

        // Haritayı mevcut şehre odakla
        map.setView([cityData.coord.lat, cityData.coord.lon], 6);

        // Her şehir için işaretleyici ekle
        for (const city of cities) {
            try {
                // Her şehir için güncel hava durumu verisi al
                const weatherResponse = await fetch(
                    `https://api.openweathermap.org/data/2.5/weather?id=${city.id}&units=metric&lang=tr&appid=${apiKey}`
                );
                const weatherData = await weatherResponse.json();

                // Özel ikon oluştur
                const customIcon = L.divIcon({
                    className: 'weather-label',
                    html: createWeatherLabel(weatherData),
                    iconSize: [120, 80],
                    iconAnchor: [60, 40]
                });

                // İşaretleyiciyi ekle
                const marker = L.marker([city.coord.lat, city.coord.lon], {
                    icon: customIcon
                }).addTo(map);

                // Popup'ı da ekle (tıklandığında daha detaylı bilgi için)
                marker.bindPopup(createWeatherPopup(weatherData));
                markers.push(marker);
            } catch (error) {
                console.error(`${city.name} için hava durumu alınamadı:`, error);
            }
        }

        // Lejant ekle
        if (!map.legend) {
            map.legend = L.control({ position: 'bottomright' });
            map.legend.onAdd = function () {
                const div = L.DomUtil.create('div', 'weather-legend');
                div.innerHTML = `
                    <div style="background: rgba(255,255,255,0.9); padding: 10px; border-radius: 5px;">
                        <h4 style="margin-bottom: 5px;">Sıcaklık Skalası</h4>
                        <div style="display: flex; align-items: center; margin-top: 5px;">
                            <span style="color: #91003f;">■</span> >30°C
                            <span style="color: #ff3800; margin-left: 10px;">■</span> 20-30°C
                            <span style="color: #fcd337; margin-left: 10px;">■</span> 10-20°C
                            <span style="color: #a0ff00; margin-left: 10px;">■</span> 0-10°C
                            <span style="color: #00c8ff; margin-left: 10px;">■</span> <0°C
                        </div>
                    </div>
                `;
                return div;
            };
            map.legend.addTo(map);
        }

    } catch (error) {
        console.error('Harita yüklenirken hata oluştu:', error);
        alert('Harita yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
}

function createWeatherLabel(cityData) {
    return `
        <div class="city-name">${cityData.name}</div>
        <div class="temp">${Math.round(cityData.main.temp)}°C</div>
        <img src="https://openweathermap.org/img/wn/${cityData.weather[0].icon}.png" 
             alt="${cityData.weather[0].description}">
    `;
}

function createWeatherPopup(cityData) {
    return `
        <div class="weather-popup">
            <h3>${cityData.name}</h3>
            <img src="https://openweathermap.org/img/wn/${cityData.weather[0].icon}@2x.png" 
                 alt="${cityData.weather[0].description}">
            <div class="temp">${Math.round(cityData.main.temp)}°C</div>
            <div class="desc">${cityData.weather[0].description}</div>
            <div class="details">
                <div>Nem: ${cityData.main.humidity}%</div>
                <div>Rüzgar: ${cityData.wind.speed} km/s</div>
            </div>
        </div>
    `;
}

function updateForecast(forecastList) {
    forecastContainer.innerHTML = '';

    // Her gün için bir tahmin oluştur (7 gün)
    const dailyForecasts = getDailyForecasts(forecastList);

    dailyForecasts.forEach((forecast) => {
        const date = new Date(forecast.dt * 1000);
        const dayName = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(date);
        const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(date);

        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';
        forecastItem.innerHTML = `
            <div class="date">
                <div>${dayName}</div>
                <div>${dayMonth}</div>
            </div>
            <img src="https://openweathermap.org/img/wn/${forecast.weather[0].icon}@2x.png" alt="${forecast.weather[0].description}">
            <div class="temp">${Math.round(forecast.main.temp)}°C</div>
            <div class="desc">${forecast.weather[0].description}</div>
        `;

        forecastContainer.appendChild(forecastItem);
    });
}

function getDailyForecasts(forecastList) {
    const dailyForecasts = [];
    const processedDates = new Set();

    // Her gün için öğlen (12:00) tahminini al
    for (const forecast of forecastList) {
        const date = new Date(forecast.dt * 1000);
        const dateString = date.toDateString();

        // Eğer bu tarih daha önce işlenmediyse ve öğlen saatine yakınsa
        if (!processedDates.has(dateString) && date.getHours() >= 11 && date.getHours() <= 13) {
            processedDates.add(dateString);
            dailyForecasts.push(forecast);

            // 7 günlük tahmin tamamlandıysa döngüden çık
            if (dailyForecasts.length === 7) {
                break;
            }
        }
    }

    return dailyForecasts;
}

async function initRoadRiskMap() {
    try {
        // Mevcut şehrin konumunu al
        const cityResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${currentCity}&units=metric&lang=tr&appid=${apiKey}`);
        const cityData = await cityResponse.json();

        if (!roadMap) {
            // Haritayı başlat
            roadMap = L.map('road-risk-map', {
                minZoom: 5,
                maxZoom: 14,
                zoomControl: true
            });

            // Temel harita katmanı
            const baseLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            });

            baseLayer.addTo(roadMap);

            // Risk kategorileri için renk kodları
            const riskColors = {
                'low': '#4caf50',       // Yeşil - Düşük risk
                'moderate': '#ffeb3b',  // Sarı - Orta risk
                'high': '#ff9800',      // Turuncu - Yüksek risk
                'very_high': '#f44336', // Kırmızı - Çok yüksek risk
                'extreme': '#9c27b0'    // Mor - Aşırı risk
            };

            // Lejant ekle
            const legend = L.control({ position: 'bottomright' });
            legend.onAdd = function () {
                const div = L.DomUtil.create('div', 'risk-legend');
                div.innerHTML = `
                    <h4>Yol Risk Seviyeleri</h4>
                    <div class="risk-item">
                        <div class="risk-color" style="background: ${riskColors.low};"></div>
                        <span>Düşük Risk</span>
                    </div>
                    <div class="risk-item">
                        <div class="risk-color" style="background: ${riskColors.moderate};"></div>
                        <span>Orta Risk</span>
                    </div>
                    <div class="risk-item">
                        <div class="risk-color" style="background: ${riskColors.high};"></div>
                        <span>Yüksek Risk</span>
                    </div>
                    <div class="risk-item">
                        <div class="risk-color" style="background: ${riskColors.very_high};"></div>
                        <span>Çok Yüksek Risk</span>
                    </div>
                    <div class="risk-item">
                        <div class="risk-color" style="background: ${riskColors.extreme};"></div>
                        <span>Aşırı Risk</span>
                    </div>
                `;
                return div;
            };
            legend.addTo(roadMap);
        }

        // Önceki işaretleyicileri temizle
        roadMarkers.forEach(marker => marker.remove());
        roadMarkers = [];

        // Haritayı mevcut şehre odakla
        roadMap.setView([cityData.coord.lat, cityData.coord.lon], 10);

        // Şehir çevresindeki yolları çiz
        await drawRoads(cityData.coord.lat, cityData.coord.lon);

    } catch (error) {
        console.error('Yol riski haritası yüklenirken hata oluştu:', error);
        alert('Yol riski haritası yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
}

async function drawRoads(lat, lon) {
    try {
        // Şehrin çevresindeki önemli yolları çiz
        const radius = 50; // km cinsinden yarıçap

        // OpenWeatherMap Road Risk API'si burada kullanılır
        // Not: Bu API OpenWeatherMap'te henüz tam olarak belgelendirilmemiş olabilir
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/roadrisk?appid=${apiKey}&lat=${lat}&lon=${lon}&radius=${radius}`
        );

        if (!response.ok) {
            throw new Error('Yol riski verileri alınamadı');
        }

        const data = await response.json();

        // Risk renklerini tanımla
        const riskColors = {
            'low': '#4caf50',       // Yeşil
            'moderate': '#ffeb3b',  // Sarı
            'high': '#ff9800',      // Turuncu
            'very_high': '#f44336', // Kırmızı
            'extreme': '#9c27b0'    // Mor
        };

        // API'den gelen veriye göre yolları çiz
        if (data && data.roads) {
            data.roads.forEach(road => {
                if (road.geometry && road.risk_level) {
                    // Yol geometrisini çiz
                    const path = L.polyline(road.geometry.map(point => [point.lat, point.lon]), {
                        color: riskColors[road.risk_level] || '#808080',
                        weight: 5,
                        opacity: 0.8
                    }).addTo(roadMap);

                    // Yol bilgisi ekle
                    path.bindPopup(`
                        <div style="text-align: center;">
                            <strong>${road.name || 'Yol'}</strong><br>
                            Risk Seviyesi: ${translateRiskLevel(road.risk_level)}<br>
                            ${road.risk_factors ? `Risk Faktörleri: ${translateRiskFactors(road.risk_factors)}` : ''}
                        </div>
                    `);

                    roadMarkers.push(path);
                }
            });
        } else {
            // Simüle edilmiş yol verileri (API çalışmıyorsa)
            simulateRoadRisks(lat, lon);
        }
    } catch (error) {
        console.error('Yol verileri çizilirken hata oluştu:', error);
        // API çalışmıyorsa simüle edilmiş verileri kullan
        simulateRoadRisks(lat, lon);
    }
}

function simulateRoadRisks(lat, lon) {
    // Risk renklerini tanımla
    const riskColors = {
        'low': '#4caf50',       // Yeşil
        'moderate': '#ffeb3b',  // Sarı
        'high': '#ff9800',      // Turuncu
        'very_high': '#f44336', // Kırmızı
        'extreme': '#9c27b0'    // Mor
    };

    const riskLevels = ['low', 'moderate', 'high', 'very_high', 'extreme'];

    // Şehirden çıkan anayolları simüle et
    const numberOfRoads = 6;
    const roadLength = 0.3; // Derece cinsinden

    for (let i = 0; i < numberOfRoads; i++) {
        const angle = (i * 2 * Math.PI) / numberOfRoads;
        const endLat = lat + roadLength * Math.sin(angle);
        const endLon = lon + roadLength * Math.cos(angle);

        // Rastgele risk seviyesi seç
        const riskLevel = riskLevels[Math.floor(Math.random() * riskLevels.length)];

        // Yolu çiz
        const path = L.polyline([[lat, lon], [endLat, endLon]], {
            color: riskColors[riskLevel],
            weight: 5,
            opacity: 0.8
        }).addTo(roadMap);

        // Yol bilgisi ekle
        path.bindPopup(`
            <div style="text-align: center;">
                <strong>Anayol ${i + 1}</strong><br>
                Risk Seviyesi: ${translateRiskLevel(riskLevel)}<br>
                Risk Faktörleri: ${getRandomRiskFactors()}
            </div>
        `);

        roadMarkers.push(path);
    }
}

function translateRiskLevel(level) {
    const translations = {
        'low': 'Düşük',
        'moderate': 'Orta',
        'high': 'Yüksek',
        'very_high': 'Çok Yüksek',
        'extreme': 'Aşırı'
    };

    return translations[level] || level;
}

function translateRiskFactors(factors) {
    if (!factors || !Array.isArray(factors)) return '';

    const translations = {
        'rain': 'Yağmur',
        'snow': 'Kar',
        'ice': 'Buz',
        'fog': 'Sis',
        'wind': 'Rüzgar',
        'thunderstorm': 'Fırtına',
        'poor_visibility': 'Düşük Görüş',
        'slippery': 'Kaygan Yol'
    };

    return factors.map(factor => translations[factor] || factor).join(', ');
}

function getRandomRiskFactors() {
    const allFactors = ['Yağmur', 'Kar', 'Buz', 'Sis', 'Rüzgar', 'Fırtına', 'Düşük Görüş', 'Kaygan Yol'];
    const shuffled = [...allFactors].sort(() => 0.5 - Math.random());
    const count = Math.floor(Math.random() * 3) + 1; // 1 ile 3 arasında faktör
    return shuffled.slice(0, count).join(', ');
}

async function getWeatherNews() {
    try {
        // Eğer önbelleğe alınmış ve son 1 saat içinde alınmış haberler varsa, önbellekten kullan
        const now = new Date();
        if (newsCache && newsCacheTime && (now - newsCacheTime) < 3600000) { // 1 saat = 3600000 ms
            displayWeatherNews(newsCache);
            return;
        }

        // Yükleniyor mesajı göster
        newsContainer.innerHTML = '<div class="loading">Haberler yükleniyor...</div>';

        // İki ayrı arama terimi için haberler getir
        const queries = ['hava durumu', 'extreme weather'];
        let allArticles = [];

        for (const query of queries) {
            // NewsAPI kullanarak hava durumu haberlerini getir
            const response = await fetch(`https://newsapi.org/v2/everything?q=${query}&language=tr&sortBy=publishedAt&pageSize=10&apiKey=${newsApiKey}`);

            if (!response.ok) {
                throw new Error('Haber verileri alınamadı');
            }

            const data = await response.json();

            if (data.articles && data.articles.length > 0) {
                allArticles = [...allArticles, ...data.articles];
            }
        }

        // Haberleri tarih sırasına göre sırala ve ilk 15'ini al
        allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        const uniqueArticles = filterUniqueArticles(allArticles).slice(0, 15);

        // Önbelleğe al
        newsCache = uniqueArticles;
        newsCacheTime = now;

        // Haberleri göster
        displayWeatherNews(uniqueArticles);

    } catch (error) {
        console.error('Haber verileri alınamadı:', error);
        newsContainer.innerHTML = `
            <div class="loading">
                Hava durumu haberleri yüklenirken bir hata oluştu.<br>
                Lütfen daha sonra tekrar deneyin veya alternatif haberler için simülasyon modunu kullanın.
                <button id="simulate-news" style="display: block; margin: 1rem auto; padding: 0.5rem 1rem; background: #5b548a; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Simülasyon Modunu Kullan
                </button>
            </div>
        `;

        // Simülasyon butonu olayı
        document.getElementById('simulate-news').addEventListener('click', () => {
            simulateWeatherNews();
        });
    }
}

function filterUniqueArticles(articles) {
    const seen = new Set();
    return articles.filter(article => {
        const duplicate = seen.has(article.title);
        seen.add(article.title);
        return !duplicate;
    });
}

function displayWeatherNews(articles) {
    newsContainer.innerHTML = '';

    articles.forEach(article => {
        const publishDate = new Date(article.publishedAt);
        const formattedDate = new Intl.DateTimeFormat('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(publishDate);

        const newsItem = document.createElement('div');
        newsItem.className = 'news-item';
        newsItem.innerHTML = `
            <h4>${article.title}</h4>
            <div class="news-meta">
                <span class="news-source">${article.source.name}</span>
                <span class="news-date">${formattedDate}</span>
            </div>
            ${article.urlToImage ? `<img src="${article.urlToImage}" alt="${article.title}" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 1rem;">` : ''}
            <p>${article.description || 'Açıklama bulunamadı.'}</p>
            <a href="${article.url}" target="_blank" class="news-link">Haberin Devamı &rarr;</a>
        `;

        newsContainer.appendChild(newsItem);
    });
}

function simulateWeatherNews() {
    const simulatedNews = [
        {
            title: 'Türkiye\'nin doğusunda şiddetli kar yağışı bekleniyor',
            source: { name: 'Hava Durumu Merkezi' },
            publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 saat önce
            description: 'Meteoroloji uzmanları, önümüzdeki hafta doğu illerinde yoğun kar yağışı beklendiğini açıkladı. Vatandaşlar dikkatli olmaları konusunda uyarıldı.',
            url: '#'
        },
        {
            title: 'İstanbul\'da fırtına: 30 uçuş iptal edildi',
            source: { name: 'Güncel Haberler' },
            publishedAt: new Date(Date.now() - 7200000).toISOString(), // 2 saat önce
            description: 'İstanbul\'da etkili olan şiddetli fırtına nedeniyle havalimanlarında 30\'dan fazla uçuş iptal edildi. Yetkililer, rüzgar hızının saatte 80 kilometreyi aştığını bildirdi.',
            url: '#'
        },
        {
            title: 'Antalya\'da sıcaklıklar mevsim normallerinin üzerinde seyredecek',
            source: { name: 'Turizm Haber' },
            publishedAt: new Date(Date.now() - 10800000).toISOString(), // 3 saat önce
            description: 'Antalya\'da önümüzdeki hafta sıcaklıkların mevsim normallerinin 5-7 derece üzerinde seyredeceği tahmin ediliyor. Sıcak hava dalgası turizm sektörünü olumlu etkileyecek.',
            url: '#'
        },
        {
            title: 'Karadeniz\'de sel felaketi: 4 ilçede okullar tatil edildi',
            source: { name: 'Bölge Haberleri' },
            publishedAt: new Date(Date.now() - 14400000).toISOString(), // 4 saat önce
            description: 'Karadeniz bölgesinde etkili olan şiddetli yağışlar sonucu meydana gelen sel nedeniyle 4 ilçede eğitime ara verildi. Bölgede arama kurtarma çalışmaları devam ediyor.',
            url: '#'
        },
        {
            title: 'Kuraklık alarmı: Barajlardaki su seviyesi kritik eşiğin altına düştü',
            source: { name: 'Çevre Haberleri' },
            publishedAt: new Date(Date.now() - 18000000).toISOString(), // 5 saat önce
            description: 'Türkiye genelinde son 3 aydır yeterli yağış alınamaması nedeniyle barajlardaki su seviyesi kritik eşiğin altına düştü. Uzmanlar su tasarrufu yapılması konusunda uyarıda bulunuyor.',
            url: '#'
        },
        {
            title: 'Eskişehir\'de dolu yağışı tarım arazilerine zarar verdi',
            source: { name: 'Tarım Haberleri' },
            publishedAt: new Date(Date.now() - 86400000).toISOString(), // 1 gün önce
            description: 'Eskişehir\'de etkili olan dolu yağışı, binlerce dönüm tarım arazisine zarar verdi. Çiftçiler, hasar tespiti için yetkililere başvurdu.',
            url: '#'
        },
        {
            title: 'Ege\'de fırtına uyarısı: Balıkçılar açılmadı',
            source: { name: 'Deniz Haber' },
            publishedAt: new Date(Date.now() - 172800000).toISOString(), // 2 gün önce
            description: 'Ege Denizi\'nde beklenen fırtına nedeniyle meteoroloji yetkilileri uyarı yaptı. Bölgedeki balıkçılar güvenlik nedeniyle denize açılmama kararı aldı.',
            url: '#'
        },
        {
            title: 'Küresel ısınma: Türkiye\'de sıcaklıklar son 50 yılın en yüksek seviyesinde',
            source: { name: 'Bilim Haberleri' },
            publishedAt: new Date(Date.now() - 259200000).toISOString(), // 3 gün önce
            description: 'Yapılan araştırmalar, Türkiye\'de ortalama sıcaklıkların son 50 yılın en yüksek seviyesine ulaştığını gösteriyor. Uzmanlar, küresel ısınmanın etkilerinin giderek arttığını belirtiyor.',
            url: '#'
        },
        {
            title: 'Şiddetli yağış İzmir\'i vurdu: Alt geçitler sular altında kaldı',
            source: { name: 'Kent Haberleri' },
            publishedAt: new Date(Date.now() - 345600000).toISOString(), // 4 gün önce
            description: 'İzmir\'de etkili olan şiddetli yağış nedeniyle birçok alt geçit sular altında kaldı. Belediye ekipleri su tahliye çalışmaları başlattı.',
            url: '#'
        },
        {
            title: 'Hava kirliliği kritik seviyede: 5 büyükşehirde alarm verildi',
            source: { name: 'Sağlık Haberleri' },
            publishedAt: new Date(Date.now() - 432000000).toISOString(), // 5 gün önce
            description: 'Türkiye\'nin 5 büyükşehirinde hava kirliliği kritik seviyeye ulaştı. Uzmanlar, özellikle astım ve KOAH hastaları başta olmak üzere risk gruplarının dışarı çıkmamasını öneriyor.',
            url: '#'
        },
        {
            title: 'Van\'da kar yağışı: Kapalı köy yolları ulaşıma açıldı',
            source: { name: 'Doğu Haberleri' },
            publishedAt: new Date(Date.now() - 518400000).toISOString(), // 6 gün önce
            description: 'Van\'da etkili olan kar yağışı nedeniyle kapalı olan 45 köy yolu, karla mücadele ekiplerinin çalışmaları sonucu yeniden ulaşıma açıldı.',
            url: '#'
        },
        {
            title: 'Marmara Bölgesi\'nde haftasonu hava nasıl olacak?',
            source: { name: 'Hava Tahmin' },
            publishedAt: new Date(Date.now() - 604800000).toISOString(), // 7 gün önce
            description: 'Meteoroloji uzmanları, Marmara Bölgesi\'nde hafta sonu parçalı bulutlu ve yer yer sağanak yağışlı hava beklendiğini açıkladı. Sıcaklıkların 3-5 derece düşmesi öngörülüyor.',
            url: '#'
        },
        {
            title: 'Atmosferdeki karbon seviyesi rekor kırdı',
            source: { name: 'İklim Haberleri' },
            publishedAt: new Date(Date.now() - 691200000).toISOString(), // 8 gün önce
            description: 'Bilim insanları, atmosferdeki karbon dioksit seviyesinin son 800 bin yılın en yüksek seviyesine ulaştığını açıkladı. Uzmanlar, acil önlem alınması gerektiği konusunda uyardı.',
            url: '#'
        },
        {
            title: 'Karadeniz\'de şiddetli yağışlar devam edecek',
            source: { name: 'Meteoroloji' },
            publishedAt: new Date(Date.now() - 777600000).toISOString(), // 9 gün önce
            description: 'Meteoroloji Genel Müdürlüğü, Karadeniz Bölgesi\'nde etkili olan şiddetli yağışların önümüzdeki hafta boyunca devam edeceğini duyurdu. Sel ve heyelan riskine karşı vatandaşlar uyarıldı.',
            url: '#'
        },
        {
            title: 'Akdeniz\'de deniz suyu sıcaklığı artıyor: Ekosistem tehdit altında',
            source: { name: 'Deniz Bilimleri' },
            publishedAt: new Date(Date.now() - 864000000).toISOString(), // 10 gün önce
            description: 'Yapılan ölçümlere göre Akdeniz\'de deniz suyu sıcaklığı son 10 yılda 2 derece arttı. Uzmanlar, bu durumun deniz ekosistemi için ciddi tehdit oluşturduğunu belirtiyor.',
            url: '#'
        }
    ];

    displayWeatherNews(simulatedNews);
}

// Haber butonu tıklama olayı
newsButton.addEventListener('click', () => {
    if (newsBox.style.display === 'none') {
        getWeatherNews();
        newsBox.style.display = 'block';
        forecastBox.style.display = 'none';
        mapBox.style.display = 'none';
        roadRiskBox.style.display = 'none';
        newsButton.textContent = 'Hava Durumu Haberlerini Gizle';
        forecastButton.textContent = '7 Günlük Tahmin Göster';
        mapButton.textContent = 'Ülke Haritasını Göster';
        roadRiskButton.textContent = 'Yol Risklerini Göster';
    } else {
        newsBox.style.display = 'none';
        newsButton.textContent = 'Hava Durumu Haberlerini Göster';
    }
});

// Yol riskleri butonu tıklama olayı
roadRiskButton.addEventListener('click', () => {
    if (roadRiskBox.style.display === 'none') {
        initRoadRiskMap();
        roadRiskBox.style.display = 'block';
        forecastBox.style.display = 'none';
        mapBox.style.display = 'none';
        newsBox.style.display = 'none';
        roadRiskButton.textContent = 'Yol Risklerini Gizle';
        forecastButton.textContent = '7 Günlük Tahmin Göster';
        mapButton.textContent = 'Ülke Haritasını Göster';
        newsButton.textContent = 'Hava Durumu Haberlerini Göster';
    } else {
        roadRiskBox.style.display = 'none';
        roadRiskButton.textContent = 'Yol Risklerini Göster';
    }
});

// Tahmin butonu tıklama olayı
forecastButton.addEventListener('click', () => {
    if (forecastBox.style.display === 'none') {
        getForecastData();
        forecastBox.style.display = 'block';
        mapBox.style.display = 'none';
        roadRiskBox.style.display = 'none';
        newsBox.style.display = 'none';
        forecastButton.textContent = '7 Günlük Tahmini Gizle';
        mapButton.textContent = 'Ülke Haritasını Göster';
        roadRiskButton.textContent = 'Yol Risklerini Göster';
        newsButton.textContent = 'Hava Durumu Haberlerini Göster';
    } else {
        forecastBox.style.display = 'none';
        forecastButton.textContent = '7 Günlük Tahmin Göster';
    }
});

// Harita butonu tıklama olayı
mapButton.addEventListener('click', () => {
    if (mapBox.style.display === 'none') {
        initMap();
        mapBox.style.display = 'block';
        forecastBox.style.display = 'none';
        roadRiskBox.style.display = 'none';
        newsBox.style.display = 'none';
        mapButton.textContent = 'Ülke Haritasını Gizle';
        forecastButton.textContent = '7 Günlük Tahmin Göster';
        roadRiskButton.textContent = 'Yol Risklerini Göster';
        newsButton.textContent = 'Hava Durumu Haberlerini Göster';
    } else {
        mapBox.style.display = 'none';
        mapButton.textContent = 'Ülke Haritasını Göster';
    }
});

// Arama butonu tıklama olayı
searchButton.addEventListener('click', () => {
    const city = searchInput.value.trim();
    if (city) {
        getWeatherData(city);

        // Tüm kutuları gizle
        forecastBox.style.display = 'none';
        mapBox.style.display = 'none';
        roadRiskBox.style.display = 'none';
        newsBox.style.display = 'none';
        historicalBox.style.display = 'none';

        // Tüm butonları sıfırla
        forecastButton.textContent = '7 Günlük Tahmin Göster';
        mapButton.textContent = 'Ülke Haritasını Göster';
        roadRiskButton.textContent = 'Yol Risklerini Göster';
        newsButton.textContent = 'Hava Durumu Haberlerini Göster';
        historicalButton.textContent = 'Geçmiş Tarihli Hava Durumu';
    }
});

// Enter tuşu ile arama
searchInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        const city = searchInput.value.trim();
        if (city) {
            getWeatherData(city);
        }
    }
});

// Tarih seçicinin maksimum tarihini bugün olarak ayarla
historicalDate.max = new Date().toISOString().split('T')[0];

// Geçmiş tarihli hava durumu butonu tıklama olayı
historicalButton.addEventListener('click', () => {
    if (historicalBox.style.display === 'none') {
        historicalBox.style.display = 'block';
        forecastBox.style.display = 'none';
        mapBox.style.display = 'none';
        roadRiskBox.style.display = 'none';
        newsBox.style.display = 'none';
        historicalButton.textContent = 'Geçmiş Tarihli Hava Durumunu Gizle';
        forecastButton.textContent = '7 Günlük Tahmin Göster';
        mapButton.textContent = 'Ülke Haritasını Göster';
        roadRiskButton.textContent = 'Yol Risklerini Göster';
        newsButton.textContent = 'Hava Durumu Haberlerini Göster';
    } else {
        historicalBox.style.display = 'none';
        historicalButton.textContent = 'Geçmiş Tarihli Hava Durumu';
    }
});

// Geçmiş tarihli veri gösterme butonu tıklama olayı
getHistoricalData.addEventListener('click', () => {
    const selectedDate = historicalDate.value;
    if (selectedDate) {
        getHistoricalWeatherData(currentCity, selectedDate);
    } else {
        alert('Lütfen bir tarih seçin');
    }
});

// Sayfa yüklendiğinde varsayılan şehir için hava durumu
getWeatherData('Istanbul');

async function getHistoricalWeatherData(city, date) {
    try {
        // Yükleniyor mesajı göster
        historicalData.innerHTML = '<div class="loading">Veriler yükleniyor...</div>';

        // Önce şehrin koordinatlarını al
        const cityResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&lang=tr&appid=${apiKey}`);

        if (!cityResponse.ok) {
            throw new Error('Şehir bulunamadı');
        }

        const cityData = await cityResponse.json();

        // Geçmiş tarihli veriyi al - OneCall Timeline API ile
        const selectedDate = new Date(date);
        const timestamp = Math.floor(selectedDate.getTime() / 1000);

        // OpenWeatherMap ücretsiz API'si geçmiş tarihli veri için çalışmayabilir
        // Bu durumda simüle edilmiş veri kullanacağız
        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/onecall/timemachine?lat=${cityData.coord.lat}&lon=${cityData.coord.lon}&dt=${timestamp}&units=metric&lang=tr&appid=${apiKey}`
            );

            if (!response.ok) {
                throw new Error('Geçmiş tarihli veri alınamadı');
            }

            const data = await response.json();
            displayHistoricalData(data.current || data.data[0], cityData.name, date);
        } catch (historyError) {
            console.error('API üzerinden geçmiş tarihli veri alınamadı:', historyError);
            // API çalışmıyorsa simülasyon modunu kullan
            simulateHistoricalData(cityData, date);
        }
    } catch (error) {
        console.error('Geçmiş tarihli veri alınamadı:', error);
        historicalData.innerHTML = `
            <div class="loading">
                Geçmiş tarihli hava durumu verisi alınamadı.<br>
                Lütfen geçerli bir tarih seçin ve tekrar deneyin ya da simülasyon modunu kullanın.
                <button id="simulate-historical" style="display: block; margin: 1rem auto; padding: 0.5rem 1rem; background: #5b548a; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Simülasyon Modunu Kullan
                </button>
            </div>
        `;

        // Simülasyon butonu olayı
        document.getElementById('simulate-historical').addEventListener('click', () => {
            simulateHistoricalData({ name: currentCity }, date);
        });
    }
}

function simulateHistoricalData(cityData, date) {
    // Simüle edilmiş hava durumu verisi oluştur
    const selectedDate = new Date(date);

    // Mevsime göre farklı hava durumları
    const month = selectedDate.getMonth();
    let temp, weather, icon, humidity, windSpeed, pressure;

    // Kış
    if (month >= 11 || month <= 1) {
        temp = Math.floor(Math.random() * 10) - 5; // -5 ile 5 arası
        const winterTypes = [
            { desc: 'kar yağışlı', icon: '13d', prob: 0.4 },
            { desc: 'parçalı bulutlu', icon: '03d', prob: 0.3 },
            { desc: 'kapalı', icon: '04d', prob: 0.2 },
            { desc: 'açık', icon: '01d', prob: 0.1 }
        ];
        weather = selectWeatherType(winterTypes);
    }
    // İlkbahar veya sonbahar
    else if (month >= 2 && month <= 4 || month >= 9 && month <= 10) {
        temp = Math.floor(Math.random() * 15) + 5; // 5 ile 20 arası
        const springFallTypes = [
            { desc: 'hafif yağmurlu', icon: '10d', prob: 0.3 },
            { desc: 'parçalı bulutlu', icon: '03d', prob: 0.3 },
            { desc: 'açık', icon: '01d', prob: 0.2 },
            { desc: 'kapalı', icon: '04d', prob: 0.2 }
        ];
        weather = selectWeatherType(springFallTypes);
    }
    // Yaz
    else {
        temp = Math.floor(Math.random() * 15) + 20; // 20 ile 35 arası
        const summerTypes = [
            { desc: 'açık', icon: '01d', prob: 0.6 },
            { desc: 'parçalı bulutlu', icon: '02d', prob: 0.2 },
            { desc: 'sağanak yağışlı', icon: '09d', prob: 0.1 },
            { desc: 'kapalı', icon: '04d', prob: 0.1 }
        ];
        weather = selectWeatherType(summerTypes);
    }

    humidity = Math.floor(Math.random() * 50) + 30; // 30 ile 80 arası
    windSpeed = (Math.random() * 9 + 1).toFixed(1); // 1 ile 10 arası
    pressure = Math.floor(Math.random() * 30) + 1000; // 1000 ile 1030 arası

    // Simüle edilmiş veriyi göster
    const simulatedData = {
        dt: selectedDate.getTime() / 1000,
        temp: temp,
        weather: [{
            description: weather.desc,
            icon: weather.icon
        }],
        humidity: humidity,
        wind_speed: windSpeed,
        pressure: pressure
    };

    displayHistoricalData(simulatedData, cityData.name, date);
}

function selectWeatherType(types) {
    // Olasılıklara göre hava durumu tipi seç
    const rand = Math.random();
    let cumProb = 0;

    for (const type of types) {
        cumProb += type.prob;
        if (rand <= cumProb) {
            return type;
        }
    }

    return types[0]; // Varsayılan olarak ilk tipi döndür
}

function displayHistoricalData(data, cityName, selectedDate) {
    const date = new Date(selectedDate);
    const formattedDate = new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);

    historicalData.innerHTML = `
        <div class="weather-info">
            <h2>${cityName}</h2>
            <p class="date">${formattedDate}</p>
            <img src="https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png" 
                 alt="${data.weather[0].description}" 
                 class="weather-icon">
            <div class="temperature">${Math.round(data.temp)}°C</div>
            <div class="description">${data.weather[0].description}</div>
            <div class="details">
                <div class="detail-item">
                    <img src="https://cdn-icons-png.flaticon.com/512/219/219816.png" alt="humidity">
                    <p>${data.humidity}%</p>
                    <p>Nem</p>
                </div>
                <div class="detail-item">
                    <img src="https://cdn-icons-png.flaticon.com/512/172/172922.png" alt="wind">
                    <p>${data.wind_speed} km/s</p>
                    <p>Rüzgar Hızı</p>
                </div>
                <div class="detail-item">
                    <img src="https://cdn-icons-png.flaticon.com/512/3845/3845731.png" alt="pressure">
                    <p>${data.pressure} hPa</p>
                    <p>Basınç</p>
                </div>
            </div>
        </div>
    `;
} 