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
   2. MODÜL: ARIZA BİLDİRİM SİSTEMİ (LocalStorage Destekli)
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

    const newRepair = {
        id: Date.now(),
        room,
        category,
        desc,
        status: "pending"
    };

    let repairs = JSON.parse(localStorage.getItem("repairs")) || [];
    repairs.unshift(newRepair);
    localStorage.setItem("repairs", JSON.stringify(repairs));

    renderRepairs();

    roomInput.value = "";
    descInput.value = "";
}

function renderRepairs() {
    const repairList = document.getElementById("repair-list");
    repairList.innerHTML = "";
    const repairs = JSON.parse(localStorage.getItem("repairs")) || [];

    repairs.forEach(repair => {
        const li = document.createElement("li");
        let badgeClass = "badge-pending";
        let badgeText = "Beklemede";
        let buttonHtml = `<button class="btn-next-status" onclick="advanceRepairStatus(${repair.id})">Durumu İlerlet</button>`;

        if (repair.status === "process") {
            badgeClass = "badge-process";
            badgeText = "Onarımda";
        } else if (repair.status === "solved") {
            badgeClass = "badge-solved";
            badgeText = "Çözüldü";
            buttonHtml = ""; 
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
    let repairs = JSON.parse(localStorage.getItem("repairs")) || [];
    const repair = repairs.find(r => r.id === id);

    if (repair) {
        if (repair.status === "pending") {
            repair.status = "process";
        } else if (repair.status === "process") {
            repair.status = "solved";
        }
        localStorage.setItem("repairs", JSON.stringify(repairs));
        renderRepairs();
    }
}

function loadRepairs() {
    renderRepairs();
}

/* ==========================================================================
   3. MODÜL: AKILLI ÇAMAŞIR REZERVASYON SİSTEMİ
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

    const newLaundry = {
        id: Date.now(),
        name: name,
        machine: machine,
        time: selectedTime,
        status: "waiting"
    };

    let laundryList = JSON.parse(localStorage.getItem("laundry")) || [];
    laundryList.push(newLaundry);
    localStorage.setItem("laundry", JSON.stringify(laundryList));

    renderLaundry();
    
    studentNameInput.value = "";
    laundryTimeInput.value = "";
}

function renderLaundry() {
    const laundryRows = document.getElementById("laundry-rows");
    laundryRows.innerHTML = "";
    const laundryList = JSON.parse(localStorage.getItem("laundry")) || [];

    laundryList.forEach(item => {
        const tr = document.createElement("tr");
        
        let statusHtml = "";
        let buttonText = "";
        let isButtonDisabled = false;

        if (item.status === "waiting") {
            statusHtml = `<span class="status-badge waiting">Bekliyor</span>`;
            buttonText = "Yıkamayı Başlat"; 
            
            const isBusy = laundryList.some(l => l.machine === item.machine && l.status === "washing");
            if (isBusy) {
                isButtonDisabled = true;
            }

        } else if (item.status === "washing") {
            statusHtml = `<span class="status-badge washing">Yıkanıyor</span>`;
            buttonText = "Çamaşırı Aldım";

        } else if (item.status === "done") {
            statusHtml = `<span class="status-badge done">Alındı</span>`;
            buttonText = "Tamamlandı";
            isButtonDisabled = true; 
        }

        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.machine}</td>
            <td>${item.time}</td>
            <td>${statusHtml}</td>
            <td>
                <button class="btn-done ${isButtonDisabled ? 'disabled' : ''}" 
                        onclick="advanceLaundryStatus(${item.id})" 
                        ${isButtonDisabled ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            </td>
        `;
        laundryRows.appendChild(tr);
    });
}

function advanceLaundryStatus(id) {
    let laundryList = JSON.parse(localStorage.getItem("laundry")) || [];
    const itemIndex = laundryList.findIndex(l => l.id === id);

    if (itemIndex !== -1) {
        const item = laundryList[itemIndex];

        if (item.status === "waiting") {
            const isBusy = laundryList.some(l => l.machine === item.machine && l.status === "washing");
            if (!isBusy) {
                item.status = "washing";
            }
        } 
        else if (item.status === "washing") {
            item.status = "done";
        }

        localStorage.setItem("laundry", JSON.stringify(laundryList));
        renderLaundry();
    }
}

function loadLaundry() {
    renderLaundry();
}

/* ==========================================================================
   4. MODÜL: YEMEK MENÜSÜ YILDIZ PUANLAMA
   ========================================================================== */
function setupStars() {
    const stars = document.querySelectorAll(".stars i");
    const savedRating = localStorage.getItem("foodRating");

    if (savedRating) {
        updateStars(savedRating);
    }
    
    stars.forEach(star => {
        star.addEventListener("click", () => {
            const currentRating = star.getAttribute("data-value");
            localStorage.setItem("foodRating", currentRating);
            updateStars(currentRating);
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