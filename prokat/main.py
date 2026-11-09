import os
import sqlite3
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Прокат Оборудования")

DATABASE = "prokat.sqlite"

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT NOT NULL,
            schedule TEXT NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            category_id TEXT,
            name TEXT NOT NULL,
            specs TEXT,
            price_per_hour REAL NOT NULL,
            image_url TEXT,
            FOREIGN KEY(category_id) REFERENCES categories(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            inv_number TEXT PRIMARY KEY,
            product_id TEXT,
            location_id INTEGER,
            status TEXT NOT NULL,
            condition TEXT NOT NULL,
            placement TEXT,
            last_check TEXT,
            FOREIGN KEY(product_id) REFERENCES products(id),
            FOREIGN KEY(location_id) REFERENCES locations(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rentals (
            id TEXT PRIMARY KEY,
            client_name TEXT NOT NULL,
            client_phone TEXT NOT NULL,
            inv_number TEXT,
            product_id TEXT,
            location_id INTEGER,
            time_start TEXT NOT NULL,
            time_end TEXT NOT NULL,
            duration_hours INTEGER NOT NULL,
            cost REAL NOT NULL,
            deposit REAL NOT NULL,
            status TEXT NOT NULL,
            condition_on_return TEXT,
            FOREIGN KEY(inv_number) REFERENCES inventory(inv_number),
            FOREIGN KEY(product_id) REFERENCES products(id),
            FOREIGN KEY(location_id) REFERENCES locations(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fines (
            id TEXT PRIMARY KEY,
            rental_id TEXT,
            client_name TEXT NOT NULL,
            reason TEXT NOT NULL,
            amount REAL NOT NULL,
            is_paid TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(rental_id) REFERENCES rentals(id)
        )
    ''')
    
    cursor.execute("DELETE FROM locations")
    cursor.execute("DELETE FROM categories")
    cursor.execute("DELETE FROM products")
    
    cursor.executemany("INSERT INTO locations VALUES (?, ?, ?, ?)", [
        (1, 'Парк Горького', 'Крымский Вал, 9', 'Ежедневно, 09:00–22:00'),
        (2, 'ВДНХ', 'Проспект Мира, 119', 'Ежедневно, 10:00–23:00'),
        (3, 'Сокольники', 'Сокольнический Вал, 1', 'Ежедневно, 08:00–22:00'),
        (4, 'Парк Фили', 'Большая Филёвская, 22', 'Ежедневно, 09:00–21:00'),
        (5, 'Лужники', 'Лужнецкая наб., 24', 'Ежедневно, 08:00–23:00'),
        (6, 'Царицыно', 'Дольская, 1', 'Ежедневно, 09:00–20:00')
    ])
    
    cursor.executemany("INSERT INTO categories VALUES (?, ?)", [
        ('bicycle', 'Велосипеды'),
        ('scooter', 'Самокаты'),
        ('ebike', 'Электровелосипеды'),
        ('longboard', 'Другое')
    ])

    cursor.executemany("INSERT INTO products VALUES (?, ?, ?, ?, ?, ?)", [
        ('prod_bike7', 'bicycle', 'Городской Стрит 7', '7 скоростей • колёса 28" • крылья', 250.0, 'https://cdn.sportmaster.ru/upload/mdm/media_content/resize/faa/352_464_101f/181892580299.jpg'), 
        ('prod_bmx', 'bicycle', 'BMX Extreme Pro', 'Для трюков • стальная рама Chroma • пеги', 300.0, 'https://cdn.sportmaster.ru/upload/mdm/media_content/resize/b91/352_464_9073/181750950299.jpg'), 
        ('prod_mountain', 'bicycle', 'Горный Трек Эксперт', '24 скорости • гидравлика • амортизатор', 350.0, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDeRn0AyV_KPIvVZD69v5W1KH-OqcdPDzpMW4l5zrCFZIkCFTIivgwD1w&s=10'), 
        ('prod_road', 'bicycle', 'Шоссейный Скорость', 'Легкая рама • 18 скоростей • руль-баран', 400.0, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQlBrWNmyKeLvNUD63y4U0W_sjn7W1uvlmMKISsoeb30g&s=10'), 
        
        ('prod_scoot1', 'scooter', 'Электро С1 Эйр', 'До 25 км/ч • запас 35 км • амортизатор', 400.0, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcStmrFbILQBg_nAApEgA7vhyYjmz-oSiWT2xOtTjMo4vQ&s=10'), 
        ('prod_kick', 'scooter', 'Детский Kick Макс', 'Трехколесный • светящиеся колеса • до 40 кг', 100.0, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRzWGOXwDqiQiloKnCfQiwjaJ8QEpKK1hcXU_LI7wKhDg&s=10'), 
        ('prod_pro_scoot', 'scooter', 'Трюковой Tech Team', 'Усиленный руль • компрессия HIC • 110мм', 180.0, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcShc5Ja0in3vvhnGtadw_TjonpapzGZ6q1b63a5N6TlMVkB9AFHGR2G54Nc&s=10'), 
        
        ('prod_ebike_e', 'ebike', 'Городской Э-Байк E-Top', 'До 25 км/ч • мотор 250W • ход до 60 км', 500.0, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTwrpmq1QQOl0IbzHLmAQjxO6NX0S6mg0kYYFWEo7ED4xKp7qqPMAW4m8&s=10'), 
        ('prod_fat_bike', 'ebike', 'Электро Фэтбайк 4х4', 'Мощность 750W • широкие колеса 4.0', 700.0, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQEUg8OOQhRObn6dVWQnIoiEHd9zp7Bxd556n-xJeJo4bWb1y-GJExSCw&s=10'), 
        
        ('prod_cruiser', 'longboard', 'Лонгборд Круизер', 'Дека 38" бамбук • мягкие колеса 78А', 150.0, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRf2wKciYnEe_y0PgrTZWgu4iQ8KlgFU5eEs-ghBV4RYQ&s=10'), 
        ('prod_board2', 'longboard', 'Скейтборд Юнион Pro', 'Канадский клен • подшипники ABEC-9', 200.0, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGUV1fSmCy_pbTr9qhbln28bsPkl55KV5QmQQRvYhAEEHl8jqU4uXPjMb_&s=10'), 
        ('prod_roller', 'longboard', 'Роликовые коньки К2', 'Алюминиевая рама • фитнес-модель', 170.0, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjbek9i5rtXdxHWcRLuUrKUaaTMR4NW9AtdCe3-y4fpA&s')
    ])

    cursor.execute("SELECT COUNT(*) FROM inventory")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("INSERT INTO inventory VALUES (?, ?, ?, ?, ?, ?, ?)", [
            ('BE-014', 'prod_bike7', 1, 'Доступен', 'Исправен', 'Стойка А - место 14', '02 нояб. 2026'),
            ('BE-008', 'prod_bike7', 1, 'В аренде', 'Исправен', 'A-1042 • срок истёк', '02 нояб. 2026'),
            ('3C-003', 'prod_scoot1', 1, 'В аренде', 'Исправен', 'A-1045 • срок истёк', '02 нояб. 2026'),
            ('3B-002', 'prod_ebike_e', 1, 'В аренде', 'Исправен', 'A-1053 • на маршруте', '02 нояб. 2026'),
            ('BE-099', 'prod_mountain', 1, 'Доступен', 'Исправен', 'Стойка Б - место 2', 'Сегодня')
        ])

    conn.commit()
    conn.close()

init_db()

class BookingRequest(BaseModel):
    client_name: str
    client_phone: str
    product_id: str
    location_id: int
    time_start: str
    time_end: str
    duration_hours: int
    cost: float

class StatusUpdateRequest(BaseModel):
    status: str
    condition: Optional[str] = None

class FineRequest(BaseModel):
    rental_id: str
    client_name: str
    reason: str
    amount: float

class InventoryRequest(BaseModel):
    inv_number: str
    product_id: str
    location_id: int
    status: str
    condition: str
    placement: str

@app.get("/api/locations")
def get_locations():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM locations")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/products")
def get_products():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/bookings")
def create_booking(req: BookingRequest):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM rentals")
    count_row = cursor.fetchone()
    count = count_row[0] if count_row else 0
    rental_id = f"A-{1042 + count}"
    
    cursor.execute("""
        SELECT inv_number FROM inventory 
        WHERE product_id = ? AND location_id = ? AND status = 'Доступен' 
        LIMIT 1
    """, (req.product_id, req.location_id))
    inv_row = cursor.fetchone()
    inv_number = inv_row['inv_number'] if inv_row else None
    
    if inv_number:
        cursor.execute("""
            UPDATE inventory 
            SET status = 'Забронирован', placement = ? || ' • выдача ' || ?
            WHERE inv_number = ?
        """, (rental_id, req.time_start, inv_number))
    
    deposit = 3000.0
    
    cursor.execute("""
        INSERT INTO rentals (id, client_name, client_phone, inv_number, product_id, location_id, time_start, time_end, duration_hours, cost, deposit, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Забронировано')
    """, (rental_id, req.client_name, req.client_phone, inv_number, req.product_id, req.location_id, req.time_start, req.time_end, req.duration_hours, req.cost, deposit))
    
    conn.commit()
    conn.close()
    return {"status": "success", "rental_id": rental_id}

@app.get("/api/my-bookings")
def get_my_bookings(phone: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.*, p.name as product_name, p.image_url, l.name as location_name 
        FROM rentals r
        JOIN products p ON r.product_id = p.id
        JOIN locations l ON r.location_id = l.id
        WHERE r.client_phone = ?
        ORDER BY r.id DESC
    """, (phone,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/manager/rentals")
def manager_get_rentals():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.*, p.name as product_name, p.id as product_code
        FROM rentals r
        JOIN products p ON r.product_id = p.id
        ORDER BY r.id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.patch("/api/manager/rentals/{rental_id}/status")
def update_rental_status(rental_id: str, req: StatusUpdateRequest):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("UPDATE rentals SET status = ? WHERE id = ?", (req.status, rental_id))
    cursor.execute("SELECT inv_number FROM rentals WHERE id = ?", (rental_id,))
    row = cursor.fetchone()
    
    if row and row['inv_number']:
        inv_number = row['inv_number']
        if req.status == 'В аренде':
            cursor.execute("UPDATE inventory SET status = 'В аренде', placement = ? || ' • срок истёк' WHERE inv_number = ?", (rental_id, inv_number))
        elif req.status == 'Завершено':
            cond = req.condition if req.condition else 'Исправен'
            cursor.execute("UPDATE inventory SET status = 'Доступен', condition = ?, placement = 'Стойка А' WHERE inv_number = ?", (cond, inv_number))
            
    conn.commit()
    conn.close()
    return {"status": "updated"}

@app.get("/api/admin/inventory")
def admin_get_inventory():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT i.*, p.name as model_name, p.specs 
        FROM inventory i
        JOIN products p ON i.product_id = p.id
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/admin/inventory")
def admin_add_inventory(req: InventoryRequest):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO inventory (inv_number, product_id, location_id, status, condition, placement, last_check)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (req.inv_number, req.product_id, req.location_id, req.status, req.condition, req.placement, "Сегодня"))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Инвентарный номер уже существует")
    conn.close()
    return {"status": "added"}

@app.get("/api/admin/fines")
def admin_get_fines():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM fines ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/admin/fines")
def admin_create_fine(req: FineRequest):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM fines")
    count_row = cursor.fetchone()
    count = count_row[0] if count_row else 0
    fine_id = f"Ш-{82 + count:04d}"
    
    now_str = "Сегодня, " + datetime.now().strftime("%H:%M")
    
    cursor.execute("""
        INSERT INTO fines (id, rental_id, client_name, reason, amount, is_paid, created_at)
        VALUES (?, ?, ?, ?, ?, 'Не оплачен', ?)
    """, (fine_id, req.rental_id, req.client_name, req.reason, req.amount, now_str))
    
    conn.commit()
    conn.close()
    return {"status": "fine_created", "fine_id": fine_id}

app.mount("/", StaticFiles(directory="public", html=True), name="public")
