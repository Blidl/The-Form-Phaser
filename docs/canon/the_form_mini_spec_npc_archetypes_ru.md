# The Form — Mini Spec: NPC Archetypes

## Назначение

Собрать обязательных для demo NPC без giant AI system и без потери глубины.

## Authoring Model

- Уровень хранит только `npcInstance`.
- Поведение, визуал, анимации и interaction лежат в `npc profile`.
- `npcInstance` хранит placement + refs + narrow overrides, а не всю NPC-логику.
- shared actor-local actions лежат в отдельном `actor action layer`, а не внутри cutscene runtime.

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
- локальные actor actions выполняются через shared action layer, а interaction только решает доступность и handoff

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
- `Triangle ↔ NPC` contact не должен чиниться post-factum выталкиванием из actor-contact слоя. Если NPC двигается и упирается в Triangle, authoritative решение должно жить в `npc runtime` как predictive movement clamp / push-before-commit, а `actor contact runtime` должен оставаться detector/debug слоем.
- `Triangle ↔ NPC` считается корректным только если Triangle может и толкать NPC/получать push, и стоять на NPC как на валидной опоре. Для этого NPC должен экспортировать triangle-friendly support surface adapter; одного `touchingPlayer` или actor-contact snapshot недостаточно.

## Риски

- Слишком ранняя попытка сделать универсальный AI toolkit.
- Смешение animation logic, behavior logic и cutscene control без границ.
- Перегруз interaction system лишними диалоговыми ветками.
- Превращение interaction в universal AI layer.
- Передача cutscene runtime владения всей NPC-логикой.

## Что потом можно уточнить

- line-of-sight;
- shared emotion system для NPC;
- больше enemy archetypes.
