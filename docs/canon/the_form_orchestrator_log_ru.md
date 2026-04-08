# The Form — Orchestrator Log

## Назначение
Это журнал результатов внешних чатов и ключевых решений по ходу реализации.

Сюда писать только:
- что реально было сделано;
- какие файлы изменились;
- что проверено вручную;
- какие новые риски или временные допущения появились;
- какой следующий шаг.

Не писать сюда большие рассуждения. Лог должен читаться быстро.

---

## Формат записи

### Entry
- `Date:` YYYY-MM-DD
- `Task:` название задачи из work queue
- `Status:` done / in_progress / blocked
- `Summary:` 2–5 коротких предложений
- `Files:` список изменённых файлов
- `Manual Check:` что реально проверено вручную
- `Architecture Decisions:` только новые или изменённые решения
- `Risks / Open Items:` что осталось спорным
- `Next Recommended Step:` какая задача идёт следующей

---

## Log Entries

### Entry
- `Date:` 2026-04-08
- `Task:` Orchestrator Setup
- `Status:` done
- `Summary:` Создан оркестраторский контур документации: общее состояние, рабочая очередь, журнал и шаблон intake. Это должно удерживать проектный контекст между многими внешними чатами и не давать потерять архитектурные решения.
- `Files:`
  - `docs/canon/the_form_orchestrator_state_ru.md`
  - `docs/canon/the_form_orchestrator_work_queue_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
  - `docs/canon/the_form_external_chat_intake_template_ru.md`
  - `docs/canon/the_form_docs_index_ru.md`
- `Manual Check:` Документы добавлены в `docs/canon`, индекс обновлён.
- `Architecture Decisions:` Canon для оркестрации вынесен в отдельный слой документов, не смешанный с feature specs.
- `Risks / Open Items:` Лог пока содержит только стартовую запись; дальше его нужно поддерживать после каждого внешнего чата.
- `Next Recommended Step:` Запускать `Never Embed Contract` как первый внешний чат и потом занести результат сюда.

### Entry
- `Date:` 2026-04-08
- `Task:` Never Embed Contract
- `Status:` in_progress
- `Summary:` Во внешнем чате добавлен post-tick safeguard в `player_runtime.ts`, который после `tickPlayerRuntime(...)` проверяет overlap Arcade-body игрока с `platform surface` и выталкивает его из финального embed-состояния. Решение сознательно локальное: без переписывания attach/carry state machine, editor или world update order. Build проходит, но живой acceptance playtest по `square attach/carry/pit` ещё не подтверждён.
- `Files:`
  - `src/game/player/player_runtime.ts`
- `Manual Check:` `npm run build-nolog` прошёл. Ручной runtime playtest с reproduce-кейсом `square attach/carry/pit` ещё не выполнен.
- `Architecture Decisions:` Never-embed сейчас реализуется как post-tick safeguard в player runtime. Приоритет отдан гарантии `не завершать кадр внутри solid`, а не локальной “красивой” коррекции attach resolve.
- `Risks / Open Items:` Safeguard не покрывает Matter-based triangle pipeline. Возможны edge cases, где square будет слегка вытолкнут наружу. Основной root cause бага всё ещё считается вероятностной комбинацией `moving support + attach/rollover/attach jump + reset after collision step`.
- `Next Recommended Step:` Выполнить ручной acceptance playtest именно на кейсе `square attach/carry/pit`. Если инвариант подтверждён, переходить к `Square Rollover by Input`. Если останутся артефакты — адресно чинить attach/carry transition до следующей задачи.

### Entry
- `Date:` 2026-04-08
- `Task:` Never Embed Contract — Manual Acceptance
- `Status:` blocked
- `Summary:` Ручная проверка и видео из интервала `2–4s` показали, что текущий `post-tick safeguard` не решает фактический баг `square attach/carry/pit`. Квадрат продолжает устойчиво проталкиваться в невалидную world-позу у стыка геометрии. Это подтверждает, что проблема лежит выше уровня простого post-tick depenetration и требует отдельного разрешения конфликта `attach/carry/world collision`.
- `Files:`
  - `src/game/player/player_runtime.ts`
  - `tmp/video_review/contact_sheet_2_4s.png`
  - `tmp/video_review/frame_06_3.25s.png`
  - `tmp/video_review/frame_07_3.50s.png`
  - `tmp/video_review/frame_08_3.75s.png`
- `Manual Check:` Видео разобрано покадрово в окне `2–4s`. На `3.50s` и `3.75s` квадрат уже устойчиво вдавлен в стык геометрии.
- `Architecture Decisions:` Never-embed safeguard остаётся как страховка, но больше не считается достаточным решением кейса `square attach/carry/pit`. Нужен отдельный attach/carry conflict resolver, где world collision имеет приоритет.
- `Risks / Open Items:` Если сразу идти дальше по списку core stability, мы закрепим неверную основу для square mechanics. Следующий fix должен явно решать: рвётся ли attach, стопорится ли carried object или квадрат переводится в безопасную позу.
- `Next Recommended Step:` Запустить новый внешний чат по задаче `Square Attach/Carry Invalid World Pose Resolution`, затем повторить ручной acceptance именно на этом reproduce-кейсе.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Attach/Carry Invalid World Pose Resolution
- `Status:` in_progress
- `Summary:` Во внешнем чате баг переопределён точнее: проблема была не только в финальном embed, а в том, что square attach-поза продолжала считаться валидной из-за inset-проверки вместо проверки полной snapped rect-позы. В ответ на это добавлена полная overlap-валидация attached pose и immediate break attach, если текущая attached-поза уже world-invalid. Это уже ближе к реальному conflict resolution между attach/carry и world collision, но ручной playtest ещё не подтверждён.
- `Files:`
  - `src/game/player/geometry/player_geometry_queries.ts`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/player_square_runtime.ts`
- `Manual Check:` `npm run build-nolog` прошёл. Ручной runtime playtest по reproduce-кейсу из видео ещё не выполнен.
- `Architecture Decisions:` Для square attach safety теперь действует более жёсткое правило: invalid world pose не может быть выбрана как attach candidate, а уже удерживаемый attach должен рваться сразу при world-invalid attached pose. Post-tick never-embed safeguard остаётся как defensive layer, а не как основное решение.
- `Risks / Open Items:` Пока не подтверждено, не сломает ли это обычный wall/floor attach, attach hold и attach jump. Не ясно, достаточно ли одного break attach, или в части кейсов нужно ещё стопорить carried object.
- `Next Recommended Step:` Повторить ровно тот же reproduce-кейс из видео. Если баг ушёл без заметной регрессии обычного attach-flow, можно перевести `Square Attach/Carry Invalid World Pose Resolution` в `done` и вернуть `Never Embed Contract` к `in_progress`/`done` по фактическому результату.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Attach/Carry Invalid World Pose Resolution — Second Manual Acceptance
- `Status:` blocked
- `Summary:` Второе видео показало, что проблема всё ещё не закрыта. Теперь видно более точно: даже после развития конфликта и фактического разрыва связки с коробкой квадрат может остаться в плохой финальной world-позе у пола/стыка. Это указывает, что одного attach invalidation недостаточно: нужен отдельный разбор порядка detach/depenetration и поведения в multi-solid corner.
- `Files:`
  - `tmp/video_review/video2/contact_sheet_2_4_5s.png`
  - `tmp/video_review/video2/frame_09_4.00s.png`
  - `tmp/video_review/video2/frame_10_4.25s.png`
  - `tmp/video_review/video2/frame_11_4.50s.png`
- `Manual Check:` Новое видео разобрано покадрово. На `4.25s` видно, что carried object уже ушёл вверх, а square всё ещё остаётся в неверной финальной позе.
- `Architecture Decisions:` Баг теперь нужно считать двухслойным: 1) attach/carry conflict resolution; 2) корректная depenetration/escape из multi-solid corner после конфликта. Эти слои надо чинить раздельно.
- `Risks / Open Items:` Если следующий fix снова попытается лечить всё одной общей страховкой, мы потеряем время. Нужен узкий task на deterministic escape vector и порядок detach/depenetration.
- `Next Recommended Step:` Подготовить новый внешний чат на задачу `Square Multi-Solid Depenetration and Detach Ordering`, опираясь на оба видео и уже внесённые partial fixes.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Multi-Solid Depenetration and Detach Ordering
- `Status:` in_progress
- `Summary:` Во внешнем чате добавлен ещё один слой square-fix в `player_runtime.ts`: snapshot до тика, память о `lastValidSquarePose`, directed escape из multi-solid corner и жёсткий порядок `detach -> body reset/depenetration -> velocity cleanup`. Это уже адресует именно остаточный кейс из второго видео, где carry-конфликт фактически распался, но square оставался в плохой финальной позе. Ручной reproduce после этого изменения ещё не выполнен.
- `Files:`
  - `src/game/player/player_runtime.ts`
- `Manual Check:` `npm run build-nolog` прошёл. Ручной playtest по второму видео-кейсу ещё не выполнен.
- `Architecture Decisions:` Для square conflict resolution теперь допустим deterministic preferred escape direction вместо чисто минимальной осевой коррекции. Источники приоритета: attach normal из pre-tick snapshot, `lastValidSquarePose`, support/contact normals, затем фиксированный fallback order.
- `Risks / Open Items:` Пока не подтверждено, что directed escape не создаст регрессии на обычном attach-flow и валидных угловых сценариях. Если reproduce всё ещё останется, следующим слоем придётся смотреть не только depenetration, но и сам порядок world/player update вокруг drag box и moving support.
- `Next Recommended Step:` Повторить именно второй видео-кейс. Если баг ушёл, закрыть `Square Multi-Solid Depenetration and Detach Ordering` и затем проверить, можно ли считать `Never Embed Contract` закрытым хотя бы для square Arcade-path. Если баг жив — делать четвёртый разбор уже по update ordering / support ownership.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Attach Face Snap Regression on Moving Supports
- `Status:` todo
- `Summary:` После последних square fix-ов появилась новая регрессия: при attach к движущемуся объекту квадрат смещается к углу support body вместо ожидаемого face-snap. По коду это больше похоже на побочный эффект ужесточённой pose validation, чем на исходный `pit/carry` баг.
- `Files:`
  - `src/game/player/geometry/player_geometry_queries.ts`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/player_square_runtime.ts`
- `Manual Check:` Пользователь вручную подтвердил визуальный симптом на moving object side contact.
- `Architecture Decisions:` Эту регрессию нужно чинить отдельно от `Square Multi-Solid Depenetration and Detach Ordering`, иначе мы будем смешивать два разных класса square bugs.
- `Risks / Open Items:` Главный риск — попытаться ослабить новые safety fixes слишком широко и вернуть исходный corner/pit bug. Следующий fix должен быть узким и возвращать normal face-snap без отката collision safety.
- `Next Recommended Step:` Запустить новый внешний чат по задаче `Square Attach Face Snap Regression on Moving Supports`.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Architecture Reframe
- `Status:` in_progress
- `Summary:` После повторяющихся square regressions принято более чистое архитектурное решение: не лечить attach/carry баги post-tick depenetration и directed escape-логикой, а вернуть authority миру и attach-pose validation. Из `player_runtime.ts` удалён слой `enforceNeverEmbedContract`, память `lastValidSquarePose` и вся логика forced escape после тика. В `resolveSquarePoseClear(...)` сохранена полная проверка snapped rect против foreign solids, но support body больше не считается конфликтом, а corner-allowance hack убран.
- `Files:`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/geometry/player_geometry_queries.ts`
- `Manual Check:` `npm run build-nolog` прошёл. Ручной runtime playtest после архитектурного упрощения ещё не выполнен.
- `Architecture Decisions:` Новый базовый контракт: square не должен насильственно "исправляться" после тика через координатные коррекции. Attach может коммититься только в валидную pose; если pose невалидна, attach должен рваться или не начинаться, а authoritative collision остаётся у мира/physics.
- `Risks / Open Items:` Возможно, это снова откроет часть исходного `pit/carry` кейса, но зато уберёт накопившиеся регрессии от symptom-driven fixes. Следующий шаг — проверить оба класса square кейсов: attach face-snap и original attach/carry/pit.
- `Next Recommended Step:` Ручной playtest по двум сценариям: 1) moving support face attach; 2) исходный attach/carry/pit reproduce. По результату решать, нужна ли ещё одна точечная square fix-итерация.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Architecture Reframe — Clean Collision Follow-up
- `Status:` in_progress
- `Summary:` Пользователь явно отверг ветку с post-tick forced reposition/depenetration как неправильное архитектурное решение. Актуальная square-стратегия теперь формулируется жёстко: мир остаётся authoritative, square не должен "лечиться" пересчётом координат после факта, attach должен либо коммититься только в валидную pose, либо немедленно рваться. Дополнительный regression fix на `corner-strip foreign overlap allowance` тоже убран, потому что он приводил к неоднозначному face/corner поведению.
- `Files:`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/geometry/player_geometry_queries.ts`
  - `src/game/player/player_square_runtime.ts`
- `Manual Check:` `npm run build-nolog` прошёл после упрощения. Новый ручной playtest ещё не занесён.
- `Architecture Decisions:` Directed escape, `lastValidSquarePose`, post-tick never-embed correction и corner-allowance hacks считаются отвергнутой symptom-driven веткой. Канонический путь: `valid attach pose or detach`, без forced body reset как базовой square-механики.
- `Risks / Open Items:` Возможно, attach/carry/pit баг частично вернётся уже без симптоматических подпорок; если это случится, следующий fix должен идти в attach/runtime ordering, а не в новый слой координатных коррекций.
- `Next Recommended Step:` Проверить два сценария после reframe: 1) face-snap на moving platform/drag box; 2) исходный attach/carry/pit reproduce. Только после этого решать, нужна ли ещё одна внешняя square-задача.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Attach Commit Path Collision Hypothesis
- `Status:` in_progress
- `Summary:` Пользователь выдвинул более сильную гипотезу: square может проходить в невалидную world-позу не потому, что неверно валидируется конечная attach-pose, а потому, что во время attach commit или возврата attach-jump временно игнорируется collision и не проверяется сам путь до snapped pose. Это смещает фокус с `pose clear` на `commit path collision gating`.
- `Files:`
  - `src/game/player/player_square_attach.ts`
  - `src/game/player/player_square_attach_jump.ts`
  - `src/game/player/player_square_runtime.ts`
  - `src/game/player/player_runtime.ts`
- `Manual Check:` Гипотеза выдвинута после ручного наблюдения текущего поведения; отдельный кодовый разбор path collision ещё не проведён в новом внешнем чате.
- `Architecture Decisions:` Если гипотеза подтвердится, правильный fix должен быть не в очередном post-factum reposition, а в том, чтобы attach/snap не коммитился через wall/floor/ceiling вообще. Мир остаётся authoritative не только в финальной позе, но и на траектории attach commit.
- `Risks / Open Items:` Возможен сценарий, где path collision и pose validation оба вносят вклад. Нельзя снова смешать их в один большой fix без доказательств. Следующий внешний чат должен целенаправленно проверить `checkCollision.none`, `reset(...)`, snap ordering и sweep/path semantics.
- `Next Recommended Step:` Запустить отдельный внешний чат по задаче `Square Attach Commit Path Collision`, а затем сверить результат с двумя ручными сценариями: normal face-snap и attach/carry/pit reproduce.

### Entry
- `Date:` 2026-04-08
- `Task:` Square Corner Passive Drift Clamp
- `Status:` done
- `Summary:` В ходе нескольких итераций выяснилось, что external-corner bug объяснялся не только active slide input и не только path collision, а ещё и пассивным attached drift: квадрат мог доезжать до самого стыка даже без корректного rollover intent. Попытки лечить это через velocity clamp, projected query и corner-stop guard были нестабильны, потому что они работали поверх уже плавающей attach pose. Рабочим решением стал более жёсткий attach-runtime контракт: любая attached pose должна сохранять минимум `1/4` контакта с текущей attach surface, иначе pose немедленно clamp'ится назад вдоль той же поверхности.
- `Files:`
  - `src/game/player/player_square_runtime.ts`
  - `src/game/player/player_runtime.ts`
  - `src/game/player/player_square_attach.ts`
  - `src/game/player/player_square_rollover.ts`
  - `docs/canon/the_form_feature_square_ru.md`
  - `docs/canon/the_form_orchestrator_state_ru.md`
  - `docs/canon/the_form_orchestrator_log_ru.md`
- `Manual Check:` Пользователь вручную подтвердил, что после ввода безусловного `1/4 contact clamp` квадрат перестал пассивно доезжать до угла в проблемном сценарии.
- `Architecture Decisions:` Для подобных square corner-bugs сначала нужно отделять active slide intent от passive attached drift. Если симптом воспроизводится без осмысленного slide input, лечить velocity недостаточно: invariant должен жить на уровне active attached pose. Minimum-contact clamp считается по current attached surface identity и не должен перекидывать square на соседнюю surface в стыке.
- `Risks / Open Items:` Нужно следить, не создаёт ли этот clamp новые edge cases на moving supports или в нетипичных corner transitions. Если появится похожий баг, сначала надо проверять, нарушен ли minimum-contact invariant, а не возвращаться к post-tick correction или случайным overlap-based retarget.
- `Next Recommended Step:` При следующих square corner regressions сначала проверять три вещи: 1) current attached surface identity; 2) minimum-contact invariant; 3) passive drift vs active slide path. Только после этого трогать rollover branch logic.
