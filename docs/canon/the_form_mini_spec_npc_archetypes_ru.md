# The Form — Mini Spec: NPC Archetypes

## Назначение

Собрать обязательных для demo NPC без giant AI system и без потери глубины.

## Authoring Model

- Уровень хранит только `npcInstance`.
- Поведение, визуал, анимации и interaction лежат в `npc profile`.

## Archetype A. Passive NPC

### Поведение

- `idle`
- `idle_patrol`
- `offer_interaction`
- `reacting`
- `resolved`

### Возможности

- interaction по `button_nearby`
- запуск cutscene
- реакция на `player emotion/state`
- outcome branches через заранее заданные result states

### Обязательный first pass

- минимум 1 passive archetype
- idle/patrol
- interaction trigger
- 2-3 reaction outcomes

## Archetype B. Enemy NPC

### Поведение

- `patrol`
- `alert`
- `chase`
- `attack_or_contact_hazard`
- `return_to_post`

### Возможности

- sensing по radius
- переключение поведения trigger-ами
- реакция на игрока без сложной combat системы

### Обязательный first pass

- минимум 1 enemy archetype
- patrol
- alert
- chase
- return

## Acceptance Criteria

- Passive NPC читается как мирный актор и умеет взаимодействовать.
- Enemy NPC читается как угроза и имеет понятный patrol/chase loop.
- NPC state можно дебажить в runtime.
- NPC настраиваются через profiles, а не хардкодятся по месту.

## Риски

- Слишком ранняя попытка сделать универсальный AI toolkit.
- Смешение animation logic, behavior logic и cutscene control без границ.
- Перегруз interaction system лишними диалоговыми ветками.

## Что потом можно уточнить

- line-of-sight;
- shared emotion system для NPC;
- больше enemy archetypes.
