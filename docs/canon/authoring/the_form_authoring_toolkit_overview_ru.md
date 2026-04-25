# The Form - Authoring Toolkit Overview (RU)

## Статус и роль документа
Этот документ фиксирует целевую архитектуру demo authoring toolkit как текущий канонический ориентир для развития инструментария.
Он описывает направление миграции и расширения, а не утверждает, что все подсистемы уже полностью реализованы.

## Ключевые принципы
- Движок проекта остается Phaser.
- Editor работает только в dev-режиме и не является частью production runtime UI.
- UI редактора гибридный:
  - Phaser viewport: сцена, gizmos, debug overlays, preview путей и коллизий.
  - DOM-слой: панели, инспекторы, вкладки, формы, timeline, списки валидации.
- Канонические authoring-данные хранятся в JSON-файлах проекта.
- `localStorage` используется только для autosave/crash recovery.
- Draft из `localStorage` не должен молча переопределять bundled JSON.

## Архитектурная стратегия
- Новые системы добавляются параллельно старым через адаптеры и миграции.
- Опасный one-shot rewrite запрещен.
- Legacy runtime/editor поведение не удаляется до подтвержденной совместимости.

## Основа нового authoring toolkit
- Action Catalog.
- Condition Catalog.
- Actor Program Runner.
- Content Registry.
- Validation Service.
- Reference Picker.
- Command-based Undo/Redo.
- Debug Recorder.

## Ограничения внедрения
- Внедрение идет итеративно, по срезам.
- Для каждого среза должны существовать data contracts, адаптеры и проверки совместимости.
- Любой новый authoring слой должен быть расширяемым и переиспользуемым между Level, NPC, Director/Cutscenes, Events и Debug.
