# The Form - Event System (RU)

## Назначение
Event system строится на shared Action Catalog и Condition Catalog и использует единые data contracts для разных источников событий.

## Поддерживаемые домены событий
Система должна поддерживать через переиспользуемые контракты:
- trigger events;
- world events;
- director events;
- NPC event reactions.

## Архитектурные ограничения
- Избегать arbitrary scripting.
- Избегать node-graph scope creep.
- Сохранять ясные границы ответственности между event orchestration и runtime slices.

## Валидация
Все ID и references обязательны к валидации до экспорта.

## Миграция
Существующие форматы event/trigger могут оставаться в переходный период через адаптеры и миграции.
