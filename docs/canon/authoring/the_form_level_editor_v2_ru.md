# The Form - Level Editor v2 (RU)

## Назначение
Level editor v2 задает целевой authoring-слой для уровней, не ломая legacy-инструменты до завершения адаптации.

## Поддерживаемые возможности v2
- freeform layout;
- configurable grid;
- layers;
- prefabs;
- prefab variants;
- multi-select;
- copy/paste;
- polygon collision model;
- camera zones;
- checkpoints;
- background editing.

## Источник истины
- Канонические level-данные хранятся в JSON-файлах проекта.
- `localStorage`-черновики должны явно маркироваться как draft/autosave.
- `localStorage` не может молча переопределять bundled JSON.

## UI-модель
Editor v2 остается гибридным:
- Phaser viewport для сцены и пространственных инструментов;
- DOM panels для списков, инспекторов, вкладок и форм.

## Контроль качества
- Перед export обязательна валидация контента.

## Миграция
Старый редактор не удаляется, пока адаптеры/миграции не подтвердят совместимость данных и сценариев.
