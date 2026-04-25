# The Form - NPC Behavior Authoring (RU)

## Модель NPC
- NPC является Actor.
- NPC поведение строится на приоритетных Behavior Pages и Event Reactions.

## Требования к поведению
- NPC может действовать параллельно и иметь program queues.
- NPC может умирать и респавниться после смерти игрока.
- NPC может работать в physics-режимах: dynamic, kinematic, static, ghost.
- NPC может толкать, атаковать, быть платформой, использовать других акторов как платформы и взаимодействовать с другими NPC.

## Authoring-основа
Для authoring поведения используются общие:
- Action Catalog;
- Condition Catalog;
- Actor Programs.

## Архитектурный запрет
- Нельзя сводить поведение NPC к одному giant controller.
- Поведение должно раскладываться на переиспользуемые runtime slices и data contracts.

## Миграция
Существующие NPC-механики сохраняются в переходный период и подключаются через адаптеры/миграции.
