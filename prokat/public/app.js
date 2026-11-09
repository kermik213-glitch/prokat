let globalProducts = [];
let globalLocations = [];
let activeCategoryFilter = 'all';
let selectedProductId = null;

document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    
    applyDynamicSessionName(path);
    
    Promise.all([
        fetch('/api/locations').then(res => res.json()),
        fetch('/api/products').then(res => res.json())
    ]).then(([locations, products]) => {
        globalLocations = locations;
        globalProducts = products;
        
        if (path.includes("client.html")) {
            initClientPage();
        } else if (path.includes("manager.html")) {
            loadManagerRentals();
        } else if (path.includes("admin.html")) {
            loadAdminInventory();
            loadAdminFines();
        }
    }).catch(err => console.error("Ошибка получения справочников с бэкенда:", err));
});

function applyDynamicSessionName(path) {
    const savedIdentity = localStorage.getItem('client_session_identity');
    
    if (path.includes("client.html")) {
        const clientProfile = document.getElementById("client-profile-name");
        if (clientProfile && savedIdentity) {
            clientProfile.innerText = savedIdentity;
        }
    } else if (path.includes("manager.html")) {
        const managerZone = document.querySelector(".user-profile-zone strong");
        if (managerZone) managerZone.innerText = "Оператор: Смена Активна";
    } else if (path.includes("admin.html")) {
        const adminZone = document.querySelector(".user-profile-zone strong");
        if (adminZone) adminZone.innerText = "Управляющий: Мария Орлова";
    }
}

function initClientPage() {
    const savedIdentity = localStorage.getItem('client_session_identity');
    
    if (savedIdentity) {
        const rentNameInput = document.getElementById("rent-client-name");
        if (rentNameInput) rentNameInput.value = savedIdentity;
        
        if (/^\+?[0-9\s\-()]{7,18}$/.test(savedIdentity)) {
            const rentPhoneInput = document.getElementById("rent-client-phone");
            const searchPhoneInput = document.getElementById("search-orders-phone");
            if (rentPhoneInput) rentPhoneInput.value = savedIdentity;
            if (searchPhoneInput) searchPhoneInput.value = savedIdentity;
        }
    }

    const select = document.getElementById("rent-location-select");
    if (select) {
        select.innerHTML = globalLocations.map(loc => 
            `<option value="${loc.id}">${loc.name}</option>`
        ).join('');
    }
    updateLocationDetails();
    renderCatalog();
}

function updateLocationDetails() {
    const select = document.getElementById("rent-location-select");
    if (!select) return;
    const locId = parseInt(select.value);
    const loc = globalLocations.find(l => l.id === locId);
    if (loc) {
        document.getElementById("current-location-text").innerText = loc.name;
        document.getElementById("current-schedule-text").innerText = loc.schedule;
    }
}

function switchClientTab(tabName) {
    document.getElementById("client-tab-catalog").style.display = tabName === 'catalog' ? 'block' : 'none';
    document.getElementById("client-tab-orders").style.display = tabName === 'orders' ? 'block' : 'none';
    
    document.getElementById("menu-catalog-btn").classList.toggle("active", tabName === 'catalog');
    document.getElementById("menu-orders-btn").classList.toggle("active", tabName === 'orders');
    
    const crumbs = document.getElementById("client-breadcrumbs");
    if (crumbs) {
        crumbs.innerText = tabName === 'catalog' ? "Прокат оборудования / Каталог" : "Прокат оборудования / Мои бронирования";
    }

    if (tabName === 'orders') {
        loadMyBookings();
    }
}


function filterCatalog(categoryId) {
    activeCategoryFilter = categoryId;
    const buttons = document.querySelectorAll("#category-filters-container .tag-btn");
    buttons.forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("onclick").includes(`'${categoryId}'`));
    });
    renderCatalog();
}

function renderCatalog() {
    const listContainer = document.getElementById("catalog-products-list");
    if (!listContainer) return;
    
    const filtered = globalProducts.filter(p => activeCategoryFilter === 'all' || p.category_id === activeCategoryFilter);
    
    listContainer.innerHTML = filtered.map(prod => {
        const isSelected = selectedProductId === prod.id;
        return `
            <div class="product-card">
                <div class="card-img-holder">
                    <span class="availability-badge">● Есть в наличии</span>
                    <img src="${prod.image_url}" alt="${prod.name}">
                </div>
                <div class="card-info">
                    <div class="card-cat">${prod.category_id.toUpperCase()}</div>
                    <div class="card-title">${prod.name}</div>
                    <div class="card-specs">${prod.specs}</div>
                    <div class="card-footer">
                        <div class="card-price">${prod.price_per_hour} ₽<span>/ час</span></div>
                        <button class="select-btn ${isSelected ? 'selected' : ''}" onclick="selectProductForRent('${prod.id}')">
                            ${isSelected ? 'Выбрано ✓' : '+ Выбрать'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function selectProductForRent(productId) {
    selectedProductId = productId;
    renderCatalog();
    calculateTotalCost();
}

function calculateTotalCost() {
    if (!selectedProductId) return;
    
    const prod = globalProducts.find(p => p.id === selectedProductId);
    const startVal = document.getElementById("rent-time-start").value;
    const endVal = document.getElementById("rent-time-end").value;
    
    if (!prod || !startVal || !endVal) return;
    
    const start = new Date(startVal);
    const end = new Date(endVal);
    
    let diffMs = end - start;
    let hours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (hours <= 0 || isNaN(hours)) hours = 1;
    
    const total = prod.price_per_hour * hours;
    
    document.getElementById("summary-hours-label").innerText = `${prod.price_per_hour} ₽ × ${hours} ч.`;
    document.getElementById("summary-base-price").innerText = `${total} ₽`;
    document.getElementById("summary-total-price").innerText = `${total} ₽`;
}

function submitBookingForm() {
    if (!selectedProductId) {
        alert("Пожалуйста, выберите транспорт из каталога перед бронированием!");
        return;
    }

    const name = document.getElementById("rent-client-name").value;
    const phone = document.getElementById("rent-client-phone").value;
    const locId = parseInt(document.getElementById("rent-location-select").value);
    const start = document.getElementById("rent-time-start").value;
    const end = document.getElementById("rent-time-end").value;

    if (!name || !phone) {
        alert("Заполните имя и контактный телефон!");
        return;
    }

    const prod = globalProducts.find(p => p.id === selectedProductId);
    let hours = Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60));
    if (hours <= 0 || isNaN(hours)) hours = 1;
    const cost = prod.price_per_hour * hours;

    const bookingData = {
        client_name: name,
        client_phone: phone,
        product_id: selectedProductId,
        location_id: locId,
        time_start: start.replace('T', ' '),
        time_end: end.replace('T', ' '),
        duration_hours: hours,
        cost: cost
    };

    fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") {
            alert(`Успешно забронировано! Номер вашей аренды: ${data.rental_id}`);
            document.getElementById("search-orders-phone").value = phone;
            switchClientTab('orders');
        }
    })
    .catch(err => console.error("Ошибка при отправке бронирования:", err));
}

function loadMyBookings() {
    const phone = document.getElementById("search-orders-phone").value;
    const tbody = document.getElementById("client-orders-table-body");
    if (!tbody) return;

    fetch(`/api/my-bookings?phone=${encodeURIComponent(phone)}`)
    .then(res => res.json())
    .then(data => {
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Бронирований по этому номеру телефона не найдено</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(rent => `
            <tr>
                <td><strong>${rent.id}</strong></td>
                <td>${rent.location_name}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${rent.image_url}" style="width:40px; height:25px; object-fit:contain;">
                        <span>${rent.product_name}</span>
                    </div>
                </td>
                <td>${rent.time_start} - ${rent.time_end} (${rent.duration_hours} ч.)</td>
                <td><strong>${rent.cost} ₽</strong> <span style="font-size:11px; color:var(--text-muted); display:block;">залог 3000 ₽</span></td>
                <td><span class="status-badge ${getStatusClass(rent.status)}">${rent.status}</span></td>
            </tr>
        `).join('');
    });
}

let managerRentalsFilter = 'all';

function filterManagerRentals(statusFilter) {
    managerRentalsFilter = statusFilter;
    const buttons = document.querySelectorAll(".filters-container .tag-btn");
    buttons.forEach(btn => btn.classList.remove("active"));
    
    if(statusFilter === 'all') document.getElementById("btn-filter-active").classList.add("active");
    if(statusFilter === 'Забронировано') document.getElementById("btn-filter-booked").classList.add("active");
    if(statusFilter === 'В аренде') document.getElementById("btn-filter-rent").classList.add("active");

    loadManagerRentals();
}

function loadManagerRentals() {
    const tbody = document.getElementById("manager-rentals-table-body");
    if (!tbody) return;

    fetch('/api/manager/rentals')
    .then(res => res.json())
    .then(data => {
        const filtered = data.filter(r => managerRentalsFilter === 'all' || r.status === managerRentalsFilter);
        document.getElementById("m-stat-active").innerText = data.filter(r => r.status === 'В аренде').length;
        document.getElementById("m-stat-overdue").innerText = data.filter(r => r.status === 'Просрочена').length;
        document.getElementById("m-stat-booked").innerText = data.filter(r => r.status === 'Забронировано').length;
        document.getElementById("m-stat-returns").innerText = data.filter(r => r.status === 'Забронировано' || r.status === 'В аренде').length;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Активных записей нет</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(rent => {
            let actionHtml = '';
            if (rent.status === 'Забронировано') {
                actionHtml = `<button class="select-btn selected" onclick="changeRentalStatus('${rent.id}', 'В аренде')">Выдать клиенту</button>`;
            } else if (rent.status === 'В аренде' || rent.status === 'Просрочена') {
                actionHtml = `<button class="select-btn" style="background:#000; color:#fff;" onclick="openReturnProcess('${rent.id}')">Принять возврат</button>`;
            } else {
                actionHtml = `<span style="color:var(--text-muted);">Завершено</span>`;
            }

            return `
                <tr>
                    <td><strong>${rent.id}</strong></td>
                    <td><strong>${rent.client_name}</strong><br><span style="font-size:12px; color:var(--text-muted);">${rent.client_phone}</span></td>
                    <td><span style="font-size:11px; background:#f3f4f6; padding:2px 6px; border-radius:4px; font-family:monospace">${rent.inv_number || 'Ожидает назначения'}</span><br>${rent.product_name}</td>
                    <td>${rent.time_start} - ${rent.time_end}<br><strong>${rent.cost} ₽</strong></td>
                    <td><span class="status-badge ${getStatusClass(rent.status)}">${rent.status}</span></td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        }).join('');
    });
}

function changeRentalStatus(rentalId, newStatus, condition = 'Исправен') {
    fetch(`/api/manager/rentals/${rentalId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, condition: condition })
    })
    .then(res => res.json())
    .then(() => {
        loadManagerRentals();
    });
}

function openReturnProcess(rentalId) {
    const condition = prompt("Укажите техническое состояние оборудования при возврате:", "Исправен");
    if (condition !== null) {
        changeRentalStatus(rentalId, 'Завершено', condition);
    }
}
function loadAdminInventory() {
    const tbody = document.getElementById("admin-inventory-table-body");
    if (!tbody) return;

    fetch('/api/admin/inventory')
    .then(res => res.json())
    .then(data => {
        document.getElementById("a-stat-total").innerText = data.length;
        document.getElementById("a-stat-ready").innerText = data.filter(i => i.status === 'Доступен').length;
        document.getElementById("a-stat-repair").innerText = data.filter(i => i.status === 'В ремонте').length;

        tbody.innerHTML = data.map(inv => `
            <tr>
                <td><strong style="font-family:monospace">${inv.inv_number}</strong></td>
                <td><strong>${inv.model_name}</strong><br><span style="font-size:12px; color:var(--text-muted);">${inv.specs}</span></td>
                <td><span style="color:${inv.condition === 'Исправен' ? '#16a34a' : '#b91c1c'}">${inv.condition}</span></td>
                <td><span class="status-badge ${getStatusClass(inv.status)}">${inv.status}</span></td>
                <td>${inv.placement || 'На руках у клиента'}</td>
                <td>${inv.last_check}</td>
            </tr>
        `).join('');
    });
}

function submitAddInventory() {
    const invNumber = document.getElementById("add-inv-number").value.trim();
    const productId = document.getElementById("add-inv-product-id").value;
    const locationId = parseInt(document.getElementById("add-inv-location-id").value);

    if (!invNumber) {
        alert("Введите инвентарный номер!");
        return;
    }

    const payload = {
        inv_number: invNumber,
        product_id: productId,
        location_id: locationId,
        status: 'Доступен',
        condition: 'Исправен',
        placement: 'Стойка А'
    };

    fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => {
        if (!res.ok) throw new Error("Дубликат номера");
        return res.json();
    })
    .then(() => {
        alert("Новая единица успешно добавлена на склад!");
        document.getElementById("add-inv-number").value = '';
        loadAdminInventory();
    })
    .catch(() => alert("Ошибка: Данный инвентарный номер уже существует в системе!"));
}

function loadAdminFines() {
    const tbody = document.getElementById("admin-fines-table-body");
    if (!tbody) return;

    fetch('/api/admin/fines')
    .then(res => res.json())
    .then(data => {
        let unpaidSum = data.filter(f => f.is_paid !== 'Оплачен').reduce((sum, f) => sum + f.amount, 0);
        document.getElementById("a-stat-fines").innerText = `${unpaidSum} ₽`;

        tbody.innerHTML = data.map(fine => `
            <tr>
                <td><strong>${fine.id}</strong></td>
                <td><a href="#" class="action-link-btn">${fine.rental_id}</a></td>
                <td><strong>${fine.client_name}</strong></td>
                <td>${fine.reason}</td>
                <td style="color:#b91c1c; font-weight:600">${fine.amount} ₽</td>
                <td><span class="status-badge" style="background:#fee2e2; color:#b91c1c">${fine.is_paid}</span></td>
                <td>${fine.created_at}</td>
            </tr>
        `).join('');
    });
}

function submitCreateFine() {
    const rentalId = document.getElementById("fine-rental-id").value.trim();
    const clientName = document.getElementById("fine-client-name").value.trim();
    const reason = document.getElementById("fine-reason").value.trim();
    const amount = parseFloat(document.getElementById("fine-amount").value);

    if (!rentalId || !clientName || !reason || isNaN(amount)) {
        alert("Заполните все поля для выписки штрафа!");
        return;
    }

    const payload = {
        rental_id: rentalId,
        client_name: clientName,
        reason: reason,
        amount: amount
    };

    fetch('/api/admin/fines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(() => {
        alert("Штраф успешно зафиксирован в системе!");
        document.getElementById("fine-rental-id").value = '';
        document.getElementById("fine-client-name").value = '';
        document.getElementById("fine-reason").value = '';
        document.getElementById("fine-amount").value = '';
        loadAdminFines();
    });
}

function handleLogout() {
    localStorage.removeItem('client_session_identity');
    window.location.href = 'index.html';
}

function getStatusClass(status) {
    switch (status) {
        case 'В аренде': return 'status-active';
        case 'Забронировано': case 'Забронирован': return 'status-booked';
        case 'Просрочена': return 'status-overdue';
        case 'Завершено': case 'Доступен': return 'status-done';
        case 'В ремонте': return 'status-repair';
        default: return '';
    }
}
