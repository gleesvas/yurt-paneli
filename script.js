// Firebase Ayarları
const firebaseConfig = {
  apiKey: "AIzaSyDQqjQ14nDWzbCzC7abJDOVIxYWbp9qosI",
  authDomain: "yurt-paneli.firebaseapp.com",
  databaseURL: "https://yurt-paneli-default-rtdb.firebaseio.com",
  projectId: "yurt-paneli",
  storageBucket: "yurt-paneli.firebasestorage.app",
  messagingSenderId: "779236033369",
  appId: "1:779236033369:web:9e3eccdb03e8fa9ae78248",
  measurementId: "G-H48TZ0E9S2"
};

// Firebase'i Başlat
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Global Kullanıcı Değişkenleri
let currentUser = "";
let isAdmin = false; 

// Sayfa ilk yüklendiğinde çalışacak tetikleyiciler
document.addEventListener("DOMContentLoaded", () => {
    checkUserIdentity(); // ÖNCE KİMLİK KONTROLÜ YAPILIYOR
    checkSilentHour();
    setupStars();
    loadRepairs();
    loadLaundry();

    // Sadece sayı girişine izin veren regex kontrolü (Oda No İçin)
    const roomInput = document.getElementById("repair-room");
    if (roomInput) {
        roomInput.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
});

/* ==========================================================================
   KİMLİK KONTROL MODÜLÜ
   ========================================================================== */
function checkUserIdentity() {
    let savedUser = localStorage.getItem("yurt_user_name");
    
    while (!savedUser || savedUser.trim() === "") {
        savedUser = prompt("Lütfen sistemde kullanmak için Adınızı ve Soyadınızı giriniz:\n(Yöneticiyseniz gizli admin kodunu giriniz)");
    }
    
    savedUser = savedUser.trim();

    // Yönetici Giriş Kontrolü
    if (savedUser === "admin123") {
        currentUser = "Sistem Yöneticisi";
        isAdmin = true;
    } else {
        currentUser = savedUser;
        isAdmin = false;
    }
    
    localStorage.setItem("yurt_user_name", savedUser); 
    
    const nameInput = document.getElementById("laundry-name");
    if (nameInput) {
        nameInput.value = currentUser;
        nameInput.disabled = true; 
    }
}

/* ==========================================================================
   1. MODÜL: SESSİZ SAAT BİLDİRİMİ
   ========================================================================== */
function checkSilentHour() {
    const alertBanner = document.getElementById("silent-hour-alert");
    const silentText = document.getElementById("silent-text");
    const currentHour = new Date().getHours();
    
    if (currentHour >= 23 || currentHour < 7) {
        alertBanner.className = "alert-banner alert-warning";
        silentText.innerText = "Sessiz Saatler (23:00 - 07:00) | Lütfen odalarda ve koridorlarda gürültü yapmayınız.";
    } else {
        alertBanner.className = "alert-banner alert-safe";
        silentText.innerText = "Serbest Saatler | Yurt içi sosyal etkileşim saati.";
    }
}

/* ==========================================================================
   2. MODÜL: ARIZA BİLDİRİM SİSTEMİ
   ========================================================================== */
function submitRepairReport() {
    const roomInput = document.getElementById("repair-room");
    const categorySelect = document.getElementById("repair-category");
    const descInput = document.getElementById("repair-desc");

    const room = roomInput.value.trim();
    const category = categorySelect.value;
    const desc = descInput.value.trim();

    if (room === "" || desc === "") {
        alert("Lütfen Oda Numarası ve Arıza Açıklaması alanlarını boş bırakmayınız!");
        return;
    }

    const id = Date.now().toString();
    const newRepair = {
        id: id,
        room: room,
        category: category,
        desc: desc,
        status: "pending",
        createdBy: currentUser || "Bilinmiyor"
    };

    database.ref('repairs/' + id).set(newRepair);

    roomInput.value = "";
    descInput.value = "";
}

let globalRepairsList = [];
function loadRepairs() {
    database.ref('repairs').on('value', (snapshot) => {
        const data = snapshot.val();
        globalRepairsList = data ? Object.values(data).reverse() : [];
        renderRepairs();
    });
}

function renderRepairs() {
    const repairList = document.getElementById("repair-list");
    repairList.innerHTML = "";

    globalRepairsList.forEach(repair => {
        const li = document.createElement("li");
        let badgeClass = "badge-pending";
        let badgeText = "Beklemede";
        
        // YETKİ KONTROLÜ: Admin mi yoksa bu kaydı oluşturan kişi mi?
        const hasAccess = (repair.createdBy === currentUser || isAdmin);

        let buttonHtml = "";
        if (repair.status === "pending") {
            if (hasAccess) buttonHtml = `<button class="btn-next-status" onclick="advanceRepairStatus('${repair.id}')">Onarıma Al</button>`;
        } else if (repair.status === "process") {
            badgeClass = "badge-process";
            badgeText = "Onarımda";
            if (hasAccess) buttonHtml = `<button class="btn-next-status" onclick="advanceRepairStatus('${repair.id}')">Çözüldü Yap</button>`;
        } else if (repair.status === "solved") {
            badgeClass = "badge-solved";
            badgeText = "Çözüldü";
        }

        // Silme butonu (Sadece sahibi veya admin görebilir)
        let deleteButtonHtml = "";
        if (hasAccess) {
            deleteButtonHtml = `
                <button onclick="deleteRepairReport('${repair.id}')" title="Bildirimi Sil" style="background-color: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-left: 5px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
        }

        const creator = repair.createdBy || "Bilinmiyor";

        li.innerHTML = `
            <div class="repair-info">
                <strong>Oda ${repair.room} - ${repair.category}</strong> <small style="color: #6b7280;">(${creator})</small>
                <p>${repair.desc}</p>
            </div>
            <div class="repair-action" style="display: flex; flex-direction: row; align-items: center; gap: 5px;">
                <span class="badge ${badgeClass}">${badgeText}</span>
                ${buttonHtml}
                ${deleteButtonHtml}
            </div>
        `;
        repairList.appendChild(li);
    });
}

function advanceRepairStatus(id) {
    const repair = globalRepairsList.find(r => r.id == id);
    if (repair) {
        // Fonksiyon içi yetki güvenlik barajı
        if (repair.createdBy !== currentUser && !isAdmin) {
            alert("Bu işleme yetkiniz yok!");
            return;
        }

        let nextStatus = repair.status;
        if (repair.status === "pending") nextStatus = "process";
        else if (repair.status === "process") nextStatus = "solved";

        database.ref('repairs/' + id).update({ status: nextStatus });
    }
}

function deleteRepairReport(id) {
    const repair = globalRepairsList.find(r => r.id == id);
    if (repair) {
        if (repair.createdBy !== currentUser && !isAdmin) {
            alert("Bu bildirimi silme yetkiniz yok!");
            return;
        }

        if (confirm("Bu arıza bildirimini tamamen silmek istediğinize emin misiniz?")) {
            database.ref('repairs/' + id).remove();
        }
    }
}

/* ==========================================================================
   3. MODÜL: AKILLI ÇAMAŞIR REZERVASYON SİSTEMİ
   ========================================================================== */
function takeLaundryRow() {
    const machineSelect = document.getElementById("machine-select");
    const laundryTimeInput = document.getElementById("laundry-time");

    const machine = machineSelect.value;
    const selectedTime = laundryTimeInput.value;

    if (selectedTime === "") {
        alert("Lütfen çamaşır atacağınız saati seçin!");
        return;
    }

    const id = Date.now().toString();
    const newLaundry = {
        id: id,
        name: currentUser || "Bilinmiyor", 
        machine: machine,
        time: selectedTime,
        status: "waiting"
    };

    database.ref('laundry/' + id).set(newLaundry);
    laundryTimeInput.value = "";
}

let globalLaundryList = [];
function loadLaundry() {
    database.ref('laundry').on('value', (snapshot) => {
        const data = snapshot.val();
        globalLaundryList = data ? Object.values(data) : [];
        renderLaundry();
    });
}

function renderLaundry() {
    const laundryRows = document.getElementById("laundry-rows");
    laundryRows.innerHTML = "";

    globalLaundryList.forEach(item => {
        const tr = document.createElement("tr");
        let statusHtml = "";
        let buttonText = "";
        let isButtonDisabled = false;

        // YETKİ KONTROLÜ: Admin mi yoksa sıranın sahibi mi?
        const hasAccess = (item.name === currentUser || isAdmin);

        if (item.status === "waiting") {
            statusHtml = `<span class="status-badge waiting">Bekliyor</span>`;
            buttonText = "Yıkamayı Başlat"; 
            const isBusy = globalLaundryList.some(l => l.machine === item.machine && l.status === "washing");
            if (isBusy) isButtonDisabled = true;
        } else if (item.status === "washing") {
            statusHtml = `<span class="status-badge washing">Yıkanıyor</span>`;
            buttonText = "Çamaşırı Aldım";
        } else if (item.status === "done") {
            statusHtml = `<span class="status-badge done">Alındı</span>`;
            buttonText = "Tamamlandı";
            isButtonDisabled = true; 
        }

        // Durum ilerletme butonu (Yetkisi yoksa kilitli görünür)
        let actionButtonHtml = "";
        if (hasAccess) {
            actionButtonHtml = `
                <button class="btn-done ${isButtonDisabled ? 'disabled' : ''}" 
                        onclick="advanceLaundryStatus('${item.id}')" 
                        ${isButtonDisabled ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            `;
        } else {
            actionButtonHtml = `<small style="color: #9ca3af;">Müdahale Edilemez</small>`;
        }

        // Sıra iptal/silme butonu (Sadece sahibi veya admin görebilir)
        let deleteButtonHtml = "";
        if (hasAccess) {
            deleteButtonHtml = `
                <button onclick="deleteLaundryRow('${item.id}')" title="Sırayı Sil" style="background-color: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-left: 5px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
        }

        tr.innerHTML = `
            <td>${item.name} ${item.name === currentUser ? '<b style="color:#10b981;">(Sen)</b>' : ''}</td>
            <td>${item.machine}</td>
            <td>${item.time}</td>
            <td>${statusHtml}</td>
            <td>
                <div style="display: flex; align-items: center;">
                    ${actionButtonHtml}
                    ${deleteButtonHtml}
                </div>
            </td>
        `;
        laundryRows.appendChild(tr);
    });
}

function advanceLaundryStatus(id) {
    const item = globalLaundryList.find(l => l.id == id);
    if (item) {
        // Fonksiyon içi yetki güvenlik barajı
        if (item.name !== currentUser && !isAdmin) {
            alert("Bu çamaşır sırası size ait değil!");
            return;
        }

        let nextStatus = item.status;
        if (item.status === "waiting") {
            const isBusy = globalLaundryList.some(l => l.machine === item.machine && l.status === "washing");
            if (!isBusy) nextStatus = "washing";
        } else if (item.status === "washing") {
            nextStatus = "done";
        }

        database.ref('laundry/' + id).update({ status: nextStatus });
    }
}

function deleteLaundryRow(id) {
    const item = globalLaundryList.find(l => l.id == id);
    if (item) {
        if (item.name !== currentUser && !isAdmin) {
            alert("Başkasına ait çamaşır sırasını silemezsiniz!");
            return;
        }

        if (confirm("Bu çamaşır sırasını tamamen iptal etmek istiyor musunuz?")) {
            database.ref('laundry/' + id).remove();
        }
    }
}

/* ==========================================================================
   4. MODÜL: YEMEK MENÜSÜ YILDIZ PUANLAMA
   ========================================================================== */
function setupStars() {
    const stars = document.querySelectorAll(".stars i");
    
    database.ref('foodRating').on('value', (snapshot) => {
        const liveRating = snapshot.val();
        if (liveRating) updateStars(liveRating);
    });
    
    stars.forEach(star => {
        star.addEventListener("click", () => {
            const currentRating = star.getAttribute("data-value");
            database.ref('foodRating').set(currentRating);
        });
    });

    function updateStars(rating) {
        stars.forEach(s => {
            if (parseInt(s.getAttribute("data-value")) <= parseInt(rating)) {
                s.className = "fa-solid fa-star active";
            } else {
                s.className = "fa-regular fa-star";
            }
        });
    }
}
