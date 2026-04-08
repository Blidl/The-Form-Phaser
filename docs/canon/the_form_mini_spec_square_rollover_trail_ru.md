# The Form — Mini Spec: Square Rollover & Trail

## Назначение

Зафиксировать поведение квадрата как честное, input-driven и топологически непрерывное.

## Контракт

### Rollover

- Если rollover геометрически валиден и игрок даёт валидный ввод, квадрат обязан перевалиться в сторону ввода.
- Если есть несколько валидных сторон, input intent имеет приоритет.
- Если rollover path невалиден, квадрат не должен ломаться или уходить в embed.

### Trail

- Trail должен быть непрерывным визуально и логически.
- Новый trail и старый trail должны соединяться без дыр.
- Углы, повторное касание и reconnect — обязательные корректные сценарии.

### Collision Safety

- При конфликте `attach/carry/world collision` мир важнее.
- Square не должен завершать кадр внутри solid geometry.
- Допустим transient overlap во внутреннем resolve, но не финальное embed-состояние.

## Дефолтные допущения

- Input — абсолютный приоритет на branch point rollover.
- Trail остаётся сегментной системой внутри runtime, но должен вести себя как единая непрерывная поверхность для gameplay.
- Логический trail и визуальный trail могут быть разными внутренними слоями, но не должны расходиться для игрока.

## Acceptance Criteria

- Corner rollover больше не залипает.
- Square переваливается в сторону ожидаемого ввода.
- Trail не оставляет микродыр и хвостов.
- Attach/carry/pit не заталкивает square в wall/floor.

## Риски

- Слишком жёсткий input priority может создать странные edge cases на невалидной геометрии.
- Если trail continuity будет только визуальной, баг вернётся в gameplay.
- Carry fixes могут затронуть attach jump и rollover.

## Что потом можно уточнить

- раздельный debug draw для logical vs visual trail;
- отдельный rollback policy для rollover failure;
- multiple carried objects, если когда-то понадобится.
