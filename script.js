// Firebase Ayarların
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
let userRefKey = ""; // Aktif kullanıcının Firebase'deki benzersiz anahtarı

// Sayfa ilk yüklendiğinde çalışacak tetikleyiciler
document.addEventListener("DOMContentLoaded", () => {
    checkUserIdentity(); 
    checkSilentHour();
    setupStars();
    loadRepairs();
    loadLaundry();
    setupKickListener(); 

    // SADECE SAYI GİRİŞİNE İZİN VEREN KONTROL:
    const roomInput = document.getElementById("repair-room");
    if (roomInput) {
        roomInput.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
});

/* ==========================================================================
   KİMLİK KONTROL VE SİDEBAR AKTİF KULLANICI / KICK MODÜLÜ
   ========================================================================== */
function checkUserIdentity() {
    let savedUser = localStorage.getItem("yurt_user_name");
    
    while (!savedUser || savedUser.trim() === "") {
        savedUser = prompt("Lütfen sistemde kullanmak için Adınızı ve Soyadınızı giriniz:\n(Yöneticiyseniz gizli admin kodunu giriniz)");
    }
    
    savedUser = savedUser.trim();

    if (savedUser === "admin123") {
        currentUser = "Sistem Yöneticisi";
        isAdmin = true;
        
        // Admin Giriş Yaptıysa Sol Menüdeki Paneli Göster ve Kullanıcıları Yükle
        document.getElementById("sidebar-admin-area").style.display = "block";
        listenActiveUsers();
    } else {
        currentUser = savedUser;
        isAdmin = false;
        
        // Normal kullanıcı giriş yaptığında kendini "Aktif Kullanıcılar" odasına kaydeder
        registerActiveUser(currentUser);
    }
    
    localStorage.setItem("yurt_user_name", savedUser); 
    
    const nameInput = document.getElementById("laundry-name");
    if (nameInput) {
        nameInput.value = currentUser;
        nameInput.disabled = true; 
    }
}

// Kullanıcıyı siteye girdiğinde aktif odaya yazan fonksiyon
function registerActiveUser(username) {
    const activeUsersRef = database.ref('activeUsers');
    // Mükerrer kaydı önlemek için önce temizlik yapıp sonra ekliyoruz
    activeUsersRef.orderByValue().equalTo(username).once('value', (snapshot) => {
        if (!snapshot.exists()) {
            const newLogRef = activeUsersRef.push();
            newLogRef.set(username);
            userRefKey = newLogRef.key;
            
            // Sekme veya tarayıcı kapatılırsa veritabanından ismi otomatik silsin
            newLogRef.onDisconnect().remove();
        } else {
            snapshot.forEach((child) => {
                userRefKey = child.key;
            });
        }
    });
}

// Sadece Admin ekranında sol menüyü canlı dolduran fonksiyon
function listenActiveUsers() {
    database.ref('activeUsers').on('value', (snapshot) => {
        const userListUi = document.getElementById("sidebar-user-list");
        userListUi.innerHTML = "";
        
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach((key) => {
                const name = data[key];
                
                // Admin kendisini listede kickleme butonuyla görmesin
                if(name !== "Sistem Yöneticisi") {
                    const li = document.createElement("li");
                    li.innerHTML = `
                        <span>${name}</span>
                        <button class="btn-sidebar-kick" onclick="kickUserRemote('${name}', '${key}')">Kick</button>
                    `;
                    userListUi.appendChild(li);
                }
            });
        } else {
            userListUi.innerHTML = "<li style='color:#7f8c8d; justify-content:center;'>Aktif kullanıcı yok</li>";
        }
    });
}

// Cihazın atılıp atılmadığını Firebase üzerinden anlık dinleyen fonksiyon
function setupKickListener() {
    database.ref('kickedUsers').on('value', (snapshot) => {
        const kickedList = snapshot.val();
        if (kickedList) {
            const originalName = localStorage.getItem("yurt_user_name");
            if (Object.values(kickedList).includes(originalName)) {
                
                // Hafızayı temizle
                localStorage.removeItem("yurt_user_name");
                
                // Atılan adamın aktif kullanıcı kaydını da sil
                if (userRefKey) {
                    database.ref('activeUsers/' + userRefKey).remove();
                }
                
                // Kicked odasındaki kaydı sil (Tekrar girebilsin diye)
                database.ref('kickedUsers').orderByValue().equalTo(originalName).once('value', (snap) => {
                    snap.forEach((childSnap) => {
                        childSnap.ref.remove();
                    });
                });

                // ÖZEL METİN UYARISI
                alert("Sistem yöneticisi sizi attı");
                window.location.reload();
            }
        }
    });
}

// Sol menüdeki Kick butonuna basınca çalışacak kod
function kickUserRemote(targetName, activeKey) {
    if (confirm(`${targetName} isimli kullanıcıyı siteden atmak istediğinize emin misiniz?`)) {
        const id = Date.now().toString();
        // Kişiyi kara listeye ekle
        database.ref('kickedUsers/' + id).set(targetName);
        // Aktif odasından temizle
        database.ref('activeUsers/' + activeKey).remove();
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

    if (room.length > 4) {
        alert("Oda numarası en fazla 4 karakter olabilir!");
        return;
    }

    if (isNaN(room)) {
        alert("Oda numarası sadece sayılardan oluşmalıdır!");
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

        let deleteButtonHtml = "";
        if (hasAccess) {
            deleteButtonHtml = `
                <button class="btn-delete-repair" onclick="deleteRepairReport('${repair.id}')" title="Bildirimi Sil">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
        }

        li.innerHTML = `
            <div class="repair-info">
                <strong>Oda ${repair.room} - ${repair.category}</strong> <small style="color: #7f8c8d;">(${repair.createdBy || 'Bilinmiyor'})</small>
                <p>${repair.desc}</p>
            </div>
            <div class="repair-action" style="display: flex; gap: 8px; align-items: center;">
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
    if (repair && repair.createdBy !== currentUser && !isAdmin) {
        alert("Bu bildirimi silme yetkiniz yok!");
        return;
    }

    if (confirm("Bu arıza bildirimini tamamen silmek istediğinize emin misiniz?")) {
        database.ref('repairs/' + id).remove();
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

        const userName = item.name || "Bilinmiyor";
        const isOwner = (userName === currentUser);
        const hasAccess = (isOwner || isAdmin);

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
            actionButtonHtml = `<small style="color: #95a5a6;">Müdahale Edilemez</small>`;
        }

        let deleteButtonHtml = "";
        if (hasAccess) {
            deleteButtonHtml = `
                <button class="btn-delete" onclick="deleteLaundryRow('${item.id}')" title="Sırayı Sil">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
        }

        tr.innerHTML = `
            <td>${userName} ${isOwner ? '<b style="color:#2ecc71;">(Sen)</b>' : ''}</td>
            <td>${item.machine}</td>
            <td>${item.time}</td>
            <td>${statusHtml}</td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center;">
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
    if (item && item.name !== currentUser && !isAdmin) {
        alert("Başkasına ait çamaşır sırasını silemezsiniz!");
        return;
    }

    if (confirm("Bu çamaşır sırasını tamamen silmek istediğinize emin misiniz?")) {
        database.ref('laundry/' + id).remove();
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
