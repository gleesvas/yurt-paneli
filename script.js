// Firebase Ayarların (Sana özel config entegre edildi)
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

// Sayfa ilk yüklendiğinde çalışacak tetikleyiciler
document.addEventListener("DOMContentLoaded", () => {
    checkSilentHour();
    setupStars();
    loadRepairs();
    loadLaundry();
});

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
   2. MODÜL: ARIZA BİLDİRİM SİSTEMİ (Firebase Canlı Sürüm)
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
        status: "pending"
    };

    // Firebase'e Gönder
    database.ref('repairs/' + id).set(newRepair);

    roomInput.value = "";
    descInput.value = "";
}

let globalRepairsList = [];
function loadRepairs() {
    // Veritabanını anlık dinle
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
        let buttonHtml = `<button class="btn-next-status" onclick="advanceRepairStatus('${repair.id}')">Durumu İlerlet</button>`;

        if (repair.status === "process") {
            badgeClass = "badge-process";
            badgeText = "Onarımda";
        } else if (repair.status === "solved") {
            badgeClass = "badge-solved";
            badgeText = "Çözüldü";
            buttonHtml = ""; 
        }

        // Arıza listesi elemanına hem durumu ilerletme butonunu hem de kırmızı çöp kutusu butonunu ekliyoruz
        li.innerHTML = `
            <div class="repair-info">
                <strong>Oda ${repair.room} - ${repair.category}</strong>
                <p>${repair.desc}</p>
            </div>
            <div class="repair-action" style="display: flex; gap: 8px; align-items: center;">
                <span class="badge ${badgeClass}">${badgeText}</span>
                ${buttonHtml}
                <button class="btn-delete-repair" onclick="deleteRepairReport('${repair.id}')" title="Bildirimi Sil" style="background-color: #e74c3c; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        repairList.appendChild(li);
    });
}

// FİRREBASE'DEN ARIZA BİLDİRİMİNİ TAMAMEN SİLEN YENİ FONKSİYON:
function deleteRepairReport(id) {
    if (confirm("Bu arıza bildirimini tamamen silmek istediğinize emin misiniz?")) {
        // Firebase'deki o ID'ye ait arıza kaydını temizler
        database.ref('repairs/' + id).remove()
            .then(() => {
                console.log("Arıza bildirimi başarıyla silindi.");
            })
            .catch((error) => {
                alert("Silme işlemi sırasında bir hata oluştu: " + error.message);
            });
    }
}

        li.innerHTML = `
            <div class="repair-info">
                <strong>Oda ${repair.room} - ${repair.category}</strong>
                <p>${repair.desc}</p>
            </div>
            <div class="repair-action">
                <span class="badge ${badgeClass}">${badgeText}</span>
                ${buttonHtml}
            </div>
        `;
        repairList.appendChild(li);
    });
}

function advanceRepairStatus(id) {
    const repair = globalRepairsList.find(r => r.id == id);
    if (repair) {
        let nextStatus = repair.status;
        if (repair.status === "pending") nextStatus = "process";
        else if (repair.status === "process") nextStatus = "solved";

        database.ref('repairs/' + id).update({ status: nextStatus });
    }
}

/* ==========================================================================
   3. MODÜL: AKILLI ÇAMAŞIR REZERVASYON SİSTEMİ (Firebase Canlı Sürüm)
   ========================================================================== */
function takeLaundryRow() {
    const studentNameInput = document.getElementById("laundry-name");
    const machineSelect = document.getElementById("machine-select");
    const laundryTimeInput = document.getElementById("laundry-time");

    const name = studentNameInput.value.trim();
    const machine = machineSelect.value;
    const selectedTime = laundryTimeInput.value;

    if (name === "" || selectedTime === "") {
        alert("Lütfen adınızı yazın ve çamaşır atacağınız saati seçin!");
        return;
    }

    const id = Date.now().toString();
    const newLaundry = {
        id: id,
        name: name,
        machine: machine,
        time: selectedTime,
        status: "waiting"
    };

    database.ref('laundry/' + id).set(newLaundry);
    
    studentNameInput.value = "";
    laundryTimeInput.value = "";
}

let globalLaundryList = [];
function loadLaundry() {
    // Veritabanını anlık dinle
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

        // Tablo satırına hem işlem butonunu hem de kırmızı çöp kutusu butonunu ekliyoruz
        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.machine}</td>
            <td>${item.time}</td>
            <td>${statusHtml}</td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="btn-done ${isButtonDisabled ? 'disabled' : ''}" 
                            onclick="advanceLaundryStatus('${item.id}')" 
                            ${isButtonDisabled ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                    <button class="btn-delete" onclick="deleteLaundryRow('${item.id}')" title="Sırayı Sil" style="background-color: #e74c3c; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        laundryRows.appendChild(tr);
    });
}

// FİRREBASE'DEN SIRAYI TAMAMEN SİLEN YENİ FONKSİYON:
function deleteLaundryRow(id) {
    if (confirm("Bu çamaşır sırasını tamamen silmek istediğinize emin misiniz?")) {
        // Firebase'deki o ID'ye ait veriyi tamamen kaldırır
        database.ref('laundry/' + id).remove()
            .then(() => {
                console.log("Sıra başarıyla silindi.");
            })
            .catch((error) => {
                alert("Silme işlemi sırasında bir hata oluştu: " + error.message);
            });
    }
}

function advanceLaundryStatus(id) {
    const item = globalLaundryList.find(l => l.id == id);
    if (item) {
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

/* ==========================================================================
   4. MODÜL: YEMEK MENÜSÜ YILDIZ PUANLAMA (Firebase Ortak Puan)
   ========================================================================== */
function setupStars() {
    const stars = document.querySelectorAll(".stars i");
    
    // Veritabanındaki güncel genel puan durumunu dinle
    database.ref('foodRating').on('value', (snapshot) => {
        const liveRating = snapshot.val();
        if (liveRating) updateStars(liveRating);
    });
    
    stars.forEach(star => {
        star.addEventListener("click", () => {
            const currentRating = star.getAttribute("data-value");
            database.ref('foodRating').set(currentRating); // Veritabanına kaydet
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
