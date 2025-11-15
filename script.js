// Глобальні змінні
const modsData = [];
const allVersions = new Set();
const allCores = new Set();
const allAuthors = new Set();

// --- 1. ЛОГІКА ЗАВАНТАЖЕННЯ ТА КЕШУВАННЯ ---

document.addEventListener('DOMContentLoaded', function() {
    loadModsWithCache();
    setupEventListeners();
    setupModals();
    setupTheme();
});

/**
 * Головна функція: завантажує дані з кешу або з сервера.
 */
async function loadModsWithCache() {
    const modListDiv = document.getElementById('mod-list');
    const cacheKey = 'modsDataCache';
    const cacheTimestampKey = 'modsDataTimestamp';
    const cacheDuration = 3600 * 1000; // 1 година в мілісекундах

    const cachedData = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cacheTimestampKey);
    const isCacheStale = !cachedTimestamp || (Date.now() - cachedTimestamp > cacheDuration);

    if (cachedData && !isCacheStale) {
        // Використовуємо дані з кешу
        console.log('Loading mods from cache...');
        const data = JSON.parse(cachedData);
        processModsData(data);
    } else {
        // Завантажуємо з сервера
        console.log('Fetching fresh mods data...');
        modListDiv.innerHTML = '<div class="loading">Завантаження модів...</div>';
        await fetchModsFromServer();
    }
}

/**
 * Завантажує дані з data.json, обробляє їх і зберігає в кеш.
 */
async function fetchModsFromServer() {
    const modListDiv = document.getElementById('mod-list');
    try {
        // Ми завантажуємо ОДИН файл. 
        // Додаємо ?t=... для обходу кешу браузера
        const response = await fetch(`data.json?t=${Date.now()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Зберігаємо в кеш
        localStorage.setItem('modsDataCache', JSON.stringify(data));
        localStorage.setItem('modsDataTimestamp', Date.now());
        
        // Обробляємо дані
        processModsData(data);
        
    } catch (error) {
        console.error('Помилка завантаження модів:', error);
        modListDiv.innerHTML = '<div class="error-message">❌ Помилка завантаження data.json: ' + error.message + '. Перевір, чи файл існує та чи правильний у ньому JSON.</div>';
    }
}

/**
 * Примусово очищує кеш і перезавантажує дані.
 */
async function forceRefreshData() {
    console.log('Forcing data refresh...');
    localStorage.removeItem('modsDataCache');
    localStorage.removeItem('modsDataTimestamp');
    // Очищуємо старі картки перед завантаженням
    document.getElementById('mod-list').innerHTML = '';
    await loadModsWithCache();
}

/**
 * Обробляє завантажені дані: заповнює глобальні масиви, фільтри та рендерить картки.
 */
function processModsData(data) {
    const modListDiv = document.getElementById('mod-list');
    modListDiv.innerHTML = '';
    
    // Очищуємо старі дані перед заповненням
    modsData.length = 0; 
    allVersions.clear();
    allCores.clear();
    allAuthors.clear();
    
    if (!data || data.length === 0) {
        modListDiv.innerHTML = '<div class="no-results">📭 Немає доступних модів у data.json</div>';
        return;
    }

    data.forEach((mod, index) => {
        modsData.push(mod); // Зберігаємо дані про мод

        // Збираємо дані для фільтрів
        const modVersions = mod.versions.map(v => v.version);
        const modLoaders = [...new Set(mod.versions.map(v => v.loader))];
        const modAuthors = [...new Set(mod.versions.map(v => v.author))];

        modVersions.forEach(v => allVersions.add(v));
        modLoaders.forEach(l => allCores.add(l));
        modAuthors.forEach(a => allAuthors.add(a));
        
        // Створюємо картку
        const card = createModCard(mod, index, modVersions, modLoaders, modAuthors);
        modListDiv.appendChild(card);
    });

    populateFilterOptions();
    filterMods(); // Застосувати фільтри одразу після завантаження
}

/**
 * Створює HTML-елемент картки мода.
 */
function createModCard(mod, index, modVersions, modLoaders, modAuthors) {
    // Сортуємо версії
    const uniqueVersions = [...new Set(modVersions)].sort((a, b) => {
        // Спрощене сортування версій (можна покращити)
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            if ((aParts[i] || 0) !== (bParts[i] || 0)) {
                return (aParts[i] || 0) - (bParts[i] || 0);
            }
        }
        return 0;
    }).filter(v => !v.startsWith('<')); // Не показуємо дивні версії у діапазоні
    
    let versionText = '';
    if (uniqueVersions.length > 0) {
        const minVersion = uniqueVersions[0];
        const maxVersion = uniqueVersions[uniqueVersions.length - 1];
        versionText = minVersion === maxVersion ? minVersion : `${minVersion} - ${maxVersion}`;
    } else {
        // Якщо є тільки "дивні" версії
        versionText = modVersions[0] || 'N/A';
    }

    const card = document.createElement('div');
    card.className = 'mod-card';
    card.dataset.name = mod.name.toLowerCase();
    card.dataset.versions = modVersions.join(' ').toLowerCase();
    card.dataset.loaders = modLoaders.join(' ').toLowerCase();
    card.dataset.authors = modAuthors.join(' ').toLowerCase();
    card.dataset.modIndex = index;

    let authorsHtml = (modAuthors.length === 1) 
        ? `<p class="authors-p"><strong>Автор перекладу:</strong> ${modAuthors[0]}</p>`
        : `<p class="authors-p" style="display: none;"></p>`;
        
    card.innerHTML = `
        <img src="${mod.imageUrl}" alt="Зображення мода ${mod.name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>❓</text></svg>'; this.onerror=null;">
        <h2>${mod.name}</h2>
        <p>${mod.description}</p>
        <p><strong>Версія:</strong> ${versionText}</p>
        <p><strong>Завантажувач:</strong> ${modLoaders.join(' - ')}</p>
        ${authorsHtml}
        <p><a href="${mod.modrinthLink}" target="_blank" style="color: #007bff;">Modrinth</a></p>
    `;

    const selectButton = document.createElement('button');
    selectButton.textContent = 'Вибрати переклад';
    selectButton.onclick = () => showSelectModal(mod);
    card.appendChild(selectButton);

    return card;
}

// --- 2. ЛОГІКА ФІЛЬТРІВ ТА ПОШУКУ ---

/**
 * Заповнює <select> опціями з зібраних даних.
 */
function populateFilterOptions() {
    const vSelect = document.getElementById('filter-version');
    const cSelect = document.getElementById('filter-core');
    const aSelect = document.getElementById('filter-author');
    
    // Очищуємо старі опції (крім першої "Всі...")
    vSelect.length = 1;
    cSelect.length = 1;
    aSelect.length = 1;

    [...allVersions].sort().forEach(v => {
        vSelect.add(new Option(v, v));
    });
    
    [...allCores].sort().forEach(c => {
        cSelect.add(new Option(c, c));
    });
    
    [...allAuthors].sort().forEach(a => {
        aSelect.add(new Option(a, a));
    });
}

/**
 * Головна функція фільтрації модів.
 */
function filterMods() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const versionFilter = document.getElementById('filter-version').value.toLowerCase();
    const coreFilter = document.getElementById('filter-core').value.toLowerCase();
    const authorFilter = document.getElementById('filter-author').value.toLowerCase();
    
    let visibleCount = 0;
    const modList = document.getElementById('mod-list');
    
    document.querySelectorAll('.mod-card').forEach(card => {
        const name = card.dataset.name;
        const versions = card.dataset.versions;
        const loaders = card.dataset.loaders;
        const authors = card.dataset.authors;
        
        const hasName = name.includes(search);
        const hasVersion = versionFilter === '' || versions.includes(versionFilter);
        const hasLoader = coreFilter === '' || loaders.includes(coreFilter);
        const hasAuthor = authorFilter === '' || authors.includes(authorFilter);

        if (hasName && hasVersion && hasLoader && hasAuthor) {
            card.classList.remove('hidden');
            visibleCount++;
            
            // Оновлюємо логіку кнопки (ефективніше)
            updateModCardButton(card, versionFilter, coreFilter, authorFilter);
            
        } else {
            card.classList.add('hidden');
        }
    });

    // Повідомлення "Нічого не знайдено"
    let noResultsDiv = modList.querySelector('.no-results-message');
    if (visibleCount === 0) {
        if (!noResultsDiv) {
            noResultsDiv = document.createElement('div');
            noResultsDiv.className = 'no-results-message';
            noResultsDiv.innerHTML = '🔍 Немає модів, що відповідають критеріям пошуку';
            modList.appendChild(noResultsDiv);
        }
    } else if (noResultsDiv) {
        noResultsDiv.remove();
    }
}

/**
 * Оптимізована функція: оновлює кнопку на картці відповідно до фільтрів.
 */
function updateModCardButton(card, versionFilter, coreFilter, authorFilter) {
    const modIndex = parseInt(card.dataset.modIndex);
    const mod = modsData[modIndex];
    const button = card.querySelector('button');
    
    if (!mod || !button) return;

    const availableTranslations = getAvailableTranslations(mod, versionFilter, coreFilter, authorFilter);
    
    // Оновлюємо автора (якщо він один)
    const authorsP = card.querySelector('.authors-p');
    if (authorsP) {
        const uniqueAuthors = [...new Set(availableTranslations.map(t => t.version.author))];
        if (uniqueAuthors.length === 1) {
            authorsP.innerHTML = `<strong>Автор перекладу:</strong> ${uniqueAuthors[0]}`;
            authorsP.style.display = 'block';
        } else {
            authorsP.style.display = 'none';
        }
    }

    // Оновлюємо кнопку
    if (availableTranslations.length === 1) {
        // Тільки один варіант - змінюємо кнопку на "Завантажити"
        const translation = availableTranslations[0];
        button.textContent = 'Завантажити';
        // Використовуємо .onclick для простого оновлення
        button.onclick = () => {
            downloadBoth(translation.version.link, translation.langFile.url, mod.name);
        };
    } else {
        // Кілька варіантів - повертаємо оригінальну кнопку
        button.textContent = 'Вибрати переклад';
        button.onclick = () => showSelectModal(mod);
    }
}

/**
 * Повертає список доступних перекладів для мода на основі фільтрів.
 */
function getAvailableTranslations(mod, versionFilter, coreFilter, authorFilter) {
    let filteredVersions = mod.versions;
    
    if (versionFilter) {
        filteredVersions = filteredVersions.filter(v => v.version.toLowerCase() === versionFilter);
    }
    if (coreFilter) {
        filteredVersions = filteredVersions.filter(v => v.loader.toLowerCase() === coreFilter);
    }
    if (authorFilter) {
        filteredVersions = filteredVersions.filter(v => v.author.toLowerCase() === authorFilter);
    }

    const translations = [];
    filteredVersions.forEach(version => {
        const langFile = mod.langFiles.find(l => l.author.toLowerCase() === version.author.toLowerCase());
        if (langFile) {
            translations.push({ version: version, langFile: langFile });
        }
    });
    
    return translations;
}

// --- 3. ЛОГІКА МОДАЛЬНИХ ВІКОН ТА ЗАВАНТАЖЕННЯ ---

/**
 * Показує модальне вікно вибору перекладу.
 */
function showSelectModal(mod) {
    const modal = document.getElementById('select-modal');
    const list = document.getElementById('select-list');
    list.innerHTML = '';
    
    // Отримуємо поточні фільтри
    const versionFilter = document.getElementById('filter-version').value.toLowerCase();
    const coreFilter = document.getElementById('filter-core').value.toLowerCase();
    const authorFilter = document.getElementById('filter-author').value.toLowerCase();

    const translations = getAvailableTranslations(mod, versionFilter, coreFilter, authorFilter);

    if (translations.length > 0) {
        translations.forEach(t => {
            const item = document.createElement('div');
            item.className = 'version-item';
            item.innerHTML = `
                <p><strong>Версія:</strong> ${t.version.version} (${t.version.loader})</p>
                <p><strong>Автор:</strong> ${t.version.author}</p>
            `;
            const downloadButton = document.createElement('button');
            downloadButton.textContent = 'Завантажити';
            downloadButton.onclick = () => downloadBoth(t.version.link, t.langFile.url, mod.name);
            item.appendChild(downloadButton);
            list.appendChild(item);
        });
    } else {
        let message = 'Немає доступних перекладів';
        if (versionFilter || coreFilter || authorFilter) {
            message += ' для вибраних фільтрів';
        }
        list.innerHTML = `<p>${message}.</p><p><a href="https://github.com/halitflyn/ua/issues" target="_blank">💡 Додати переклад?</a></p>`;
    }
    
    modal.style.display = 'block';
}

/**
 * Завантажує обидва файли (.jar і .json).
 */
async function downloadBoth(jarUrl, jsonUrl, modName) {
    try {
        // Download JAR
        const jarFilename = jarUrl.split('/').pop();
        const jarResponse = await fetch(jarUrl);
        if (!jarResponse.ok) throw new Error(`Failed to download JAR: ${jarResponse.statusText}`);
        
        const jarBlob = await jarResponse.blob();
        const jarLink = document.createElement('a');
        jarLink.href = URL.createObjectURL(jarBlob);
        jarLink.download = jarFilename;
        document.body.appendChild(jarLink); // Потрібно для Firefox
        jarLink.click();
        document.body.removeChild(jarLink);
        URL.revokeObjectURL(jarLink.href);

        // Download JSON
        // Додаємо затримку, щоб браузер не заблокував спливаючі вікна
        await new Promise(resolve => setTimeout(resolve, 500)); 
        
        const jsonFilename = jsonUrl.split('/').pop();
        const jsonResponse = await fetch(jsonUrl);
        if (!jsonResponse.ok) throw new Error(`Failed to download JSON: ${jsonResponse.statusText}`);
        
        const jsonBlob = await jsonResponse.blob();
        const jsonLink = document.createElement('a');
        jsonLink.href = URL.createObjectURL(jsonBlob);
        jsonLink.download = jsonFilename;
        document.body.appendChild(jsonLink); // Потрібно для Firefox
        jsonLink.click();
        document.body.removeChild(jsonLink);
        URL.revokeObjectURL(jsonLink.href);
        
        // alert(`✅ Файли успішно завантажено!\n\n📦 ${jarFilename}\n📄 ${jsonFilename}`);
        
    } catch (error) {
        console.error('Download error:', error);
        alert('❌ Помилка завантаження файлів: ' + error.message);
    }
}

/**
 * Функція об'єднання .jar та .json (Твій код - він чудовий!)
 * Вона викликається з HTML (onclick), тому має бути глобальною.
 */
async function combineFiles() {
    // JSZip має бути завантажений (перевірка)
    if (typeof JSZip === 'undefined') {
        alert('❌ Помилка: бібліотека JSZip не завантажена.');
        return;
    }

    const modFile = document.getElementById('mod-file').files[0];
    const jsonFile = document.getElementById('json-file').files[0];
    
    if (!modFile || !jsonFile) {
        alert('❌ Будь ласка, виберіть обидва файли!');
        return;
    }
    
    if (!modFile.name.endsWith('.jar')) {
        alert('❌ Перший файл повинен бути .jar файлом мода!');
        return;
    }
    
    if (!jsonFile.name.endsWith('.json')) {
        alert('❌ Другий файл повинен бути .json файлом перекладу!');
        return;
    }
    
    if (!confirm('Об\'єднати файли? Це створить новий .jar файл з перекладом.')) {
        return;
    }
    
    try {
        const zip = new JSZip();
        
        const jarData = await modFile.arrayBuffer();
        await zip.loadAsync(jarData);
        
        const jsonContent = await jsonFile.text();
        
        let modid = 'unknown';

        // Перевірка Forge
        const modsToml = zip.file('META-INF/mods.toml');
        if (modsToml) {
            const tomlContent = await modsToml.async('string');
            const modidMatch = tomlContent.match(/modId\s*=\s*"([^"]+)"/);
            if (modidMatch) modid = modidMatch[1];
        } 
        // Перевірка Fabric/Quilt
        else {
            const fabricJson = zip.file('fabric.mod.json');
            if (fabricJson) {
                const jsonContentMod = await fabricJson.async('string');
                const modMeta = JSON.parse(jsonContentMod);
                modid = modMeta.id;
            }
        }
        
        if (modid === 'unknown') {
            // Додаткова перевірка для NeoForge (якщо інша)
            const neoToml = zip.file('META-INF/neoforge.mods.toml');
            if (neoToml) {
                 const tomlContent = await neoToml.async('string');
                 const modidMatch = tomlContent.match(/modId\s*=\s*"([^"]+)"/);
                 if (modidMatch) modid = modidMatch[1];
            } else {
                 alert('❌ Не вдалося автоматично визначити modid. Об\'єднайте вручну.');
                 return;
            }
        }
        
        const langPath = `assets/${modid}/lang/uk_ua.json`;
        console.log(`Adding translation to: ${langPath}`);
        zip.file(langPath, jsonContent);
        
        const newZipBlob = await zip.generateAsync({type: 'blob'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(newZipBlob);
        link.download = modFile.name.replace('.jar', '_translated.jar');
        document.body.appendChild(link); // Потрібно для Firefox
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        alert('✅ Файли успішно об\'єднано!');
        
    } catch (error) {
        console.error('Combine error:', error);
        alert('❌ Помилка об\'єднання файлів: ' + error.message);
    }
}

// --- 4. НАЛАШТУВАННЯ СЛУХАЧІВ ТА ІНШОГО ---

/**
 * Налаштовує всіх слухачів подій.
 */
function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', filterMods);
    document.getElementById('filter-version').addEventListener('change', filterMods);
    document.getElementById('filter-core').addEventListener('change', filterMods);
    document.getElementById('filter-author').addEventListener('change', filterMods);
    
    document.getElementById('refresh-data').addEventListener('click', forceRefreshData);
    
    document.getElementById('combine-open').onclick = () => {
        document.getElementById('combine-modal').style.display = 'block';
    };
    
    document.querySelector('.help-button').onclick = () => {
        document.getElementById('help-modal').style.display = 'block';
    };
}

/**
 * Налаштовує логіку закриття для всіх модальних вікон.
 */
function setupModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => modal.style.display = 'none';
        }
        
        // Закриття по кліку поза вікном
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Закриття по кнопці Esc
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });
}

/**
 * Налаштовує перемикач теми.
 */
function setupTheme() {
    const themeToggle = document.querySelector('.theme-toggle');
    const body = document.body;
    const savedTheme = localStorage.getItem('theme');
    
    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-theme');
            themeToggle.textContent = '☀️';
            localStorage.setItem('theme', 'dark');
        } else {
            body.classList.remove('dark-theme');
            themeToggle.textContent = '🌙';
            localStorage.setItem('theme', 'light');
        }
    }
    
    // Застосувати збережену тему або тему системи
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    
    themeToggle.onclick = () => {
        if (body.classList.contains('dark-theme')) {
            applyTheme('light');
        } else {
            applyTheme('dark');
        }
    };
}
