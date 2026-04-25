# The Form - Action Catalog и Condition Catalog (RU)

## Назначение
Action Catalog и Condition Catalog являются общей authoring-основой и единым словарем действий/условий для toolkit.

## Канонические требования
- Для действий и условий обязательны стабильные `typeId`.
- Один и тот же `typeId` должен сохранять совместимый контракт между версиями либо мигрироваться явным шагом.

## Контракт для каждого нового action type
Каждое новое действие обязано определить:
- runtime contract (что делает и какие входы/выходы ожидаются);
- editor schema (структура authoring-полей);
- validation rules;
- reference fields (какие ID/ссылки использует);
- debug/recording metadata, где это полезно.

## Переиспользование каталогов
Каталог должен использоваться единообразно в:
- Actor Programs;
- NPC Behavior;
- Director Timeline;
- Events;
- Debug/recording.

## Что запрещено
- Копипаст независимых action vocabulary для каждого редактора.
- Разрозненные несовместимые типы действий/условий для одинаковых runtime-сценариев.

## Миграционный принцип
Существующие форматы могут поддерживаться через адаптеры, но целевой слой authoring должен сходиться к shared catalog contract.
