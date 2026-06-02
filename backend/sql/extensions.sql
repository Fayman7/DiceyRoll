-- История бросков (только для авторизованных)
CREATE TABLE IF NOT EXISTS dice_rolls (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dice_type VARCHAR(10) NOT NULL CHECK (dice_type IN ('d4','d6','d8','d10','d12','d20')),
    result INTEGER NOT NULL
);

-- Кому пользователь «поделился» изображением (владелец — uploads.user_id)
CREATE TABLE IF NOT EXISTS image_shares (
    id SERIAL PRIMARY KEY,
    img_id INTEGER NOT NULL REFERENCES uploads(img_id) ON DELETE CASCADE,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (img_id, to_user_id)
);

-- Игровые комнаты
CREATE TABLE IF NOT EXISTS game_rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_room_members (
    room_id INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (room_id, user_id)
);

-- Списки предметов для случайной генерации
CREATE TABLE IF NOT EXISTS item_lists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS item_list_items (
    id SERIAL PRIMARY KEY,
    list_id INTEGER NOT NULL REFERENCES item_lists(id) ON DELETE CASCADE,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_item_lists_owner
    ON item_lists(owner_id);

CREATE INDEX IF NOT EXISTS idx_item_list_items_list_id
    ON item_list_items(list_id);

-- История генерации случайных предметов
CREATE TABLE IF NOT EXISTS item_generation_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    list_id INTEGER NOT NULL REFERENCES item_lists(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES item_list_items(id) ON DELETE SET NULL,
    item_value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_item_generation_history_user
    ON item_generation_history(user_id);
