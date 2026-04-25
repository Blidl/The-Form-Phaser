# The Form - Debug и Validation (RU)

## Сервисная архитектура
- Validation Service независим от UI.
- Reference Picker независим от UI и использует Content Registry.
- Debug Recorder переиспользуется для Actor Programs, NPC, Events и Director.

## Severity-модель валидации
- `error`
- `warning`
- `info`

## Обязательность проверки
Контентная валидация обязательна перед экспортом.

## Что должна ловить валидация
- missing IDs;
- missing references;
- invalid action types;
- invalid condition types;
- bad paths;
- invalid cutscene clips;
- unsafe localStorage/source-of-truth confusion.
