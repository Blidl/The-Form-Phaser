# The Form — Mini Spec: Lighting Direction

## Назначение

Добиться атмосферного 2D-света и сценической глубины без попытки строить full physically-based pipeline.

## Художественная цель

Ощущение света должно быть ближе к:

- мягкой сценической композиции;
- читаемому разделению фигур и фона;
- эмоциональному цветовому тону уровня;
- акцентам на форме, а не на техническом реализме.

## Технический контракт

- Освещение profile-driven.
- Уровень получает `lightingProfileId`.
- В профиле есть:
  - `ambientColor`
  - `ambientIntensity`
  - `lights[]`
  - flags для player/surfaces
- Lighting — это слой presentation, а не фундамент симуляции.
- Система должна быть пригодна для live tuning через debug panel.

## First-pass visual grammar

- `ambient` задаёт общий эмоциональный тон
- `key light` даёт главный акцент
- `fill light` смягчает сцену
- `parallax + tint + VFX` работают вместе со светом, а не отдельно от него

## Практическое правило

Для demo свет делаем ограниченно и осознанно:

- hero scenes
- key moments
- readable silhouettes
- emphasis on player/NPC/forms

Не делаем:

- full-scene overengineered lighting everywhere
- зависимость всех сцен от normal map pipeline
- обязательность heavy lighting для слабых web устройств

## Acceptance Criteria

- Уровень имеет читаемый световой характер.
- Player и NPC отделяются от фона.
- Свет можно быстро подкрутить в runtime.
- Профиль легко правится через JSON.

## Риски

- Слишком сильная ставка на WebGL-only polish.
- Попытка заменить art direction одним только lighting.
- Чрезмерное количество динамических lights для web-first demo.

## Что потом можно уточнить

- fake rim light;
- player-specific lighting response;
- fallback mode без dynamic lights;
- selective normal maps только для hero objects.
