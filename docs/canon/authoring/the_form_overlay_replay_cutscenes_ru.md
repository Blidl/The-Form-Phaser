# The Form - Overlay Replay Cutscenes (RU)

## Определение
Overlay replay cutscenes - это пассивные picture-in-picture baked sampled replays с частотой 30 FPS.

## Поведение воспроизведения
- Во время overlay replay базовая игра под ним должна замораживаться/ставиться на паузу.
- Replay не является live simulation.

## Стабильность контента
- Replay-ассеты должны продолжать работать даже если исходный уровень позже изменился.
- Воспроизведение не должно зависеть от текущей геометрии уровня в момент playback.

## Данные и валидация
- Replay-данные должны иметь стабильные asset references.
- Validation Service должен проверять целостность replay-данных и ссылок до экспорта.
