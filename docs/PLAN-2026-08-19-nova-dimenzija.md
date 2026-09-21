# План: Нова димензија за Фото Градежен Дневник

> Стратешки план + интернет истражување — нова димензија, нови функции, повисоко ниво на постоечките.
> **Датум:** 2026-08-19 · **Статус:** Draft · **Верзија:** 0.1

---

## 1. Извршно резиме

Фото Градежен Дневник денес е **web-only** апликација (Next.js 16 + Supabase) со: auth, проекти, фото upload со EXIF/GPS, временска линија, дефекти, присуство и PDF извештаи. Оваа анализа (4 паралелни интернет истражувања, извори на крајот) покажува дека **најголемата пазарна празнина е photo-first комуникација** — никој од лидерите не третира фотографијата како *порака*, туку како прилог на задача.

**Трите стратешки столба за новата димензија:**

1. **Live комуникација + брза интервенција** — фотографијата станува порака: слика → означи (annotate) → пинирај (pin) → @спомни одговорен → следи потврда → автоматска ескалација. Дополнето со WebSocket live фид и push известувања (SMS fallback).
2. **Користење на можностите на телефонот** — GPS/EXIF печат, **QR кодови како чек-пунктови** (највисок ROI хардверски feature), офлајн-first ред со sync, Bluetooth/BLE за алати и сензори (нативно), LiDAR/AR мерења (iOS), NFC (ниша).
3. **Издржливи иновативни функции** — гласовно-прва фотација (voice + photo → структуриран запис), AI-напишани дневни извештаи, **sporedluvanje: same-viewpoint споредба на фотографии** (единствен диференцијатор), VLM класификација со човечка потврда.

**Клучен заклучок од истражувањето:** секој лидер има документирана слабост (комплексност, цена, мобилна доверливост, интеграции) — тоа се отворите за фокусирана, photo-first апликација. WhatsApp е *де факто* комуникацискиот слој на терен (64–66% од екипите) — планот мора да се натпреварува со неговата нула-фрикција, не против него.

---

## 2. Анализа на топ 5 платформи во светот

Рангирање според пазарна големина (приходи, корисници) × релевантност за фото документација. Извори: SEC извештаи, официјални страници, G2/Capterra/Reddit (2025–2026).

### 2.1 Procore — лидер по обем

| Аспект | Детали |
|---|---|
| **Што е** | Најголема градежна платформа ($1.3B приходи 2025, 17,850+ клиенти), целосен пакет: PM, quality/safety, финансии, field |
| **Фото** | Photos модул со markup/annotations; daily logs; инспекции со фото доказ; punch lists |
| **Соработка** | **Unlimited-user модел** (без цена по седиште) — субизведувачите се поканети бесплатно; real-time фид + известувања |
| **Mobile** | iOS/Android, офлајн способни workflow-и |
| **AI** | Procore Copilot + Datagrid аквизиција (февруари 2026) |
| **Интеграции** | Најголем екосистем: 400+ интеграции (вкл. Raken, QuickBooks, Sage) |
| **Цена** | Фиксна врз годишен обем + пакет модули; скапо за мали тимови |
| **Слабости** | "Тешко за учење и скапо" (Reddit r/ConstructionManagers); плаќање за неискористени модули; комплексноста е #1 бариера |
| **Поука за нас** | Unlimited-user цените ја симнуваат адопциската бариера за субизведувачи; комплексноста на лидерот = нашата шанса |

### 2.2 Autodesk Forma (поранешен ACC) — континуитет design→build

| Аспект | Детали |
|---|---|
| **Што е** | Autodesk AEC облак; **24.03.2026 ребрендирање**: ACC → Forma, Build → Forma Build, Docs → Forma Data Management |
| **Фото** | Photo модул маркетиран како "непобитен доказ"; **Forma Build Essentials** (март 2026, за мали тимови): punch list + issues со фотографии и локации |
| **AI** | Најагресивен AI патоказ: **Project Data Agent GA** (март 2026), Autodesk Assistant (природно-јазични прашања над specs/RFIs/issues со цитати) |
| **Mobile** | iOS/Android (PlanGrid наследство); **проблеми: "LOGGING OFF EVERY 5MINS"** (Capterra, јули 2026), проекти не се симнуваат по re-login |
| **Цена** | ~$800/седиште/год (историски Build); G2: "steep cost, particularly for smaller firms" |
| **Слабости** | Стрмна крива на учење, комплексна permission матрица, мобилна недоверливост |
| **Поука за нас** | **AI-над-проектни-податоци** (прашај → одговор со цитати) станува table stakes; фокусот на една работа + сигурен mobile = победа |

### 2.3 Fieldwire (Hilti) — field-first стандард

| Аспект | Детали |
|---|---|
| **Што е** | Field-first апликација базирана на планови/задачи/фотографии; 4M+ проекти; Hilti сопственост |
| **Фото** | Фото со **мета-печат (време/локација)**; markup на планови; **360° фотографии** (Business tier+); sheet compare |
| **Mobile** | **Целосен офлајн режим**: документи, инспекции, фотографии офлајн, авто-sync при конекција; **GPS координати во офлајн фотографии** ако е дозволена локација |
| **Слабости** | Малку интеграции (документирана слабост); скапо за големи тимови; архивирани проекти недостапни во mobile (Forbes 2024) |
| **Оценки** | 4.5/5 G2, 4.6/5 Capterra — фален за интуитивност и mobile-first |
| **Поука за нас** | **Офлајн-first со GPS-печатени фотографии е must-have** за кредибилитет на терен; интеграциската празнина е клин: биди слој што *игра убаво со* Procore/ACC, не што ги заменува |

### 2.4 Raken — специјалист за дневни извештаи

| Аспект | Детали |
|---|---|
| **Што е** | Daily-report специјалист: 4,500+ фирми, ~70,000 корисници; позициониран *покрај* Procore, не наместо него |
| **Фото** | Дневни извештаи со **time-stamped фотографии и видеа**, voice-to-text нарација, **auto-branded PDF** (време, труд, **AI executive summary**) |
| **AI** | Три конкретни AI функции (не chatbot): **auto photo-tagging при upload**, **face-recognition time clock**, **AI дневни извештаи** (PM чита 30 сек наместо 10 мин) |
| **Mobile** | Најсилниот mobile сигнал во категоријата: **iOS 4.8/5 (~21,000 оценки)** — подобар од Procore, Buildertrend, Fieldwire, CompanyCam |
| **Слабости** | Нема scheduling, нема job costing, нема client portal; **photo viewer не може да zoom**; file-size лимити; Android несигурност; не е за residential |
| **Поука за нас** | **Voice-to-text + time-stamped media + auto-generated извештај = златниот стандард на теренскиот workflow**; AI треба да биде 3 конкретни функции, не chatbot; пер-фото лимитите се болка што можеме да ја надминеме |

### 2.5 OpenSpace — 360° визуелна интелигенција

| Аспект | Детали |
|---|---|
| **Што е** | 360° reality capture: прошетка со 360° камера → сликите автоматски се мапираат на планови/BIM со AI progress tracking |
| **Фото** | **Capture** (360° прошетки на floor plans), **Field** (issue logging со **Autolocation + Voice Notes** — Suffolk: времето за документација -86%), **Track** (billing-grade AI progress), **BIM+**, **Air** (дрон, мај 2025) |
| **AI** | Најдлабоката AI приказна: **Disperse аквизиција** (окт 2025) → 700+ визуелни компоненти, 200+ задачи; човечки-верификувани извештаи за 24–48ч |
| **Цена** | ACV-based, само sales; ~$10K минимум за фирми <$40M приходи; хардвер дополнително (Insta360 X3 $375 / X5 $645) |
| **Слабости** | Записите се корумпираат на долги прошетки; задолжителен "expert-led onboarding"; зависи од хардвер; нула residential интеграции |
| **Поука за нас** | 360°/AI progress верификација е премиум категорија — но **автоматското мапирање на фотографии на планови/локации е функцијата што треба да ја гониме** (без хардвер, со обични телефонски фотографии) |

### 2.6 Табела на топ 5

| Платформа | Пазарен сигнал 2026 | Фото | Офлајн+GPS | AI | Цена | Најдобра за | Клучна празнина |
|---|---|---|---|---|---|---|---|
| **Procore** | $1.3B приходи, 17,850 клиенти | ✓ доказен слој | ✓ | Copilot + Datagrid | Volume-based, unlimited users | Enterprise GCs | Комплексност, цена |
| **Autodesk Forma** | AEC инкумбент; ребренд март 2026 | ✓ + Essentials | ✓ (session проблеми) | Project Data Agent GA | ~$800/седиште/год | AEC design→build | Учење, mobile доверливост |
| **Fieldwire** | 4M+ проекти (Hilti) | ✓ печати, 360° | ✓ целосен + GPS | Минимална | Per-user freemium→Plus | Plan-based екипи | Интеграции, цена на обем |
| **Raken** | 70K корисници, 4,500 фирми | ✓ time-stamped | ✓ | Photo-tag, face-clock, AI summary | Sales ~$15–46/корисник | Commercial дневни извештаи | Нема scheduling/job costing |
| **OpenSpace** | 360° лидер | ✓ 360° + AI | ✓ | Track, Autolocation, Voice | ACV, ~$10K мин | BIM-heavy комерцијални | Хардвер, доверливост |

**Почитени спомнувања (релевантни):** SiteCapture (едноставна фото документација со annotations), Fonn (mobile-first snagging, гео-означени фотографии, офлајн), Kairnial (offline-first со селективен sync, QR код за опрема), BuildPass (AI, дневни извештаи), Buildertrend (residential ниша), StructionSite/HoloBuilder/DroneDeploy (360°/дрон прогресија).

---

## 3. Live комуникација и брза интервенција

### 3.1 Што прават лидерите (патерни)

1. **Procore Conversations** — централизиран chat: @ментирања, групни DM, **конверзации поврзани со проектни ставки** (RFI, submittals, задачи) и **зачувани во audit trail**; chat може да се конвертира во RFI (неформален → формален workflow). **Procore Incidents + Workflows** (од 15.06): сериозност → приматели по сериозност → рутирање каде custom полиња одлучуваат за следниот чекор (near-miss vs injury; ризикот ескалира до лидерство).
2. **Fieldwire** — push известувања во моментот на креирање/ажурирање задача; @ и # брзо доделување; QR кодови поврзуваат физички локации со задачи; офлајн sync.
3. **Raken** — Activity feed = real-time хронолошки стрим (дневни извештаи, фотографии, check-ins) — најблиското нешто до "site timeline"; **Live Views** вградуваат надворешни камери (TrueLook, EarthCam, HoloBuilder, DroneDeploy) во dashboard.
4. **Autodesk Forma** — Issues модул: креирање од форма → ескалација до RFI → офлајн sync; **webhooks (HMAC-SHA256 потпишани)**; SyncWorks мостови до Teams/Slack/WhatsApp.

**Резиме на патернот:** (1) push известувања на workflow настани, (2) chat нишки врзани за ставки, (3) ескалација во формални процеси (RFI/incident), (4) вградени камери. **Никој нема "photo-first комуникација"** — фотографиите се прилози на задачи, не самата порака.

### 3.2 Реалноста на терен (WhatsApp)

- **USP Research (Европа, 2025):** 64% од изведувачите користат IM апликации професионално (Шпанија 91%, Италија 82%, Холандија 68%).
- **Velora AI:** 66% од градилиштата користат WhatsApp како примарен канал, 10–25 WhatsApp групи по градилиште.
- **Confluence 2025:** фирмите имаат просечно 86.8 апликации; Microsoft Teams ~97% пенетрација ("baseline, not a tool").
- **Zello (push-to-talk):** до 7,000 корисници по канал, еден-притисок емергенци, SDK; LafargeHolcim: -5 мин. време за одговор.
- **Teamwire** — ниша за безбедна/енкриптирана комуникација (data-sovereign hosting).

**Реалност:** посветените апликации **не го заменуваат WhatsApp — се натпреваруваат со него**. Добитниот патерн: (1) сретни ги екипите во WhatsApp (in-chat форми, ботови) или (2) направи ја апликацијата толку моментална и нула-фрикциска колку WhatsApp.

### 3.3 Ескалација и известување (патерни)

Зрел патерн: **тригер** (geofence влез, QR скан, SOS притисок, поле за сериозност) → **рутирање по улога/сериозност** → **push + SMS fallback** → **следење на потврда (acknowledgment)** → **автоматска ескалација при timeout** (SALUS модел).

**Аналоген патерн за нашата апликација:**
> Фотографија → означена/анотирана → **пинирана на локација** → **@спомнување одговорен по улога** → push + SMS → **следи потврда** → **автоматска ескалација (RFI/incident) при timeout**.

### 3.4 Live видео интеграции

EarthCam (live 4K + PTZ + AI analytics, интеграција во Procore Daily Logs), Raken Live Views (вградување TrueLook/EarthCam/HoloBuilder/DroneDeploy), DJI Dock 3 (автоматски дрон патроли), TrueLook, OxBlue.

**Заклучок:** live видео е *viewing* слој (мониторинг на прогрес, безбедност), не комуникациски канал. За нас, соседната можност е **live фото стрим (site timeline)** — поевтино, поактивно, усогласено со тоа како екипите веќе комуницираат.

### 3.5 UX сознанија: зошто посветените апликации пропаѓаат

- **Fit failure, не training failure** — екипите ја напуштаат апликацијата зашто не одговара на workflow-от (офлајн/конекција, двоен внес, конфузија од повеќе апликации); "гласаат со палците".
- **JBKnowledge ConTech Report:** дневното известување и фото/видео се топ mobile field употреби; 48% усвојуваат софтвер само ако има лесен mobile app; ~34% велат слаба адопција = #1 предизвик.
- **In-chat beats external:** WhatsApp in-chat форми достигнуваат ~60% адопција vs ~20% за надворешни апликации; со AI агент во групата — речиси целосна адопција (77.5 тикети/ден).
- **Field-first beats desktop-first:** ~40% адопција (desktop-first) vs 95% (field-first).

**Заклучок:** адопција = нула-фрикција (малку тапови, работи офлајн, без account за субизведувачи), во-контекст (сретни ги каде што се), една-цел. Нашата апликација треба да биде **photo-first исклучокот: еден тап за слика, еден тап за ознака, еден тап за ping** — во постоечкиот тек на екипата.

### 3.6 Пазарна празнина (суштината)

Сите платформи третираат фотографиите како прилози, а chat како одделен слој. **Никој не нуди photo-центрична комуникација: анотираната фотографија Е пораката, пинот Е локацијата, @спомнувањето Е доделувањето.** Најблиски: Site Report Expert (finger markup, zip share преку WhatsApp, subs без account) и Kraaft (WhatsApp-стил chat + структурирани задачи + гео-означени фотографии) — но ниту една не е целосна photo-first комуникациска платформа.

**Архитектурски импликации (за издржлив дизајн):**
- **WebSockets** за real-time presence и live ажурирања (патернот Raken Activity feed)
- **Push известувања** како примарен канал + **SMS fallback** за работници без паметни телефони (Heed патерн)
- **Presence + рутирање по улога** (Procore Workflows патерн): следи потврда, авто-ескалирај на timeout (SALUS)
- **Geofence/QR тригери** за авто-прикачување на контекст на локација (TRUCE/SiteConnect)
- **Webhook out** (Autodesk HMAC-SHA256 патерн) — фотографиите/issues течат во Procore/ACC/Teams
- **Офлајн-first sync** (Fieldwire патерн) — не е преговарачко на терен

---

## 4. Користење на можностите на телефонот (Bluetooth и сè друго)

### 4.1 Bluetooth / BLE

- **Употреби:** Beacon присуство (BeaconTrax, myComply "Smart Brick" + Procore интеграција); следење алати (Hilti ON!Track T320 Bluetooth tag); **надворешни сензори/алати**: инспекциски камери, IR термометри, влагомери, **ласерски мерачи** (Huepar ±1/16"), Bluetooth принтери за етикети (Zebra/Brother).
- **Feasibility:** BLE е универзален; **iOS ги рестриктира background beacon advertising/ranging**; Android попермисивен но гладен за батерија.
- **Web:** **Web Bluetooth работи само на Chrome/Edge/Opera/Android — НЕ на Firefox, Safari/iOS.** Web-only BLE = Android-only. За background beacons и доверливо поврзување со сензори треба **native** (CoreBluetooth / android.bluetooth).
- **Издржливост:** Траен, основен тренд (Hilti, Procore екосистем, myComply) — не е hype.

### 4.2 GPS / GNSS (вкл. гео-означени фотографии)

- **Употреби:** Geofenced присуство (Jibble, ClockShark, FieldPulse); dual-frequency GNSS за survey-близок степен; **гео-означена фото документација** = killer feature (PHOTO iD, BuildLog, Fieldly, SiteCam — печат на координати/алтитуда/компас на секоја фотографија, export PDF/CSV/KMZ).
- **Feasibility:** Web `navigator.geolocation` дава координати + точност (95% доверба, ~5–10 m) — **без raw GNSS во browser**. Нативно: raw GNSS, подобри indoor хибридни фиксови.
- **Чесно ограничување:** внатре (челик/бетон) GPS опаѓа → комбинирај GPS + QR чек-пунктови + рачно пинирање на план.
- **Издржливост:** Трајно и очекувано — осигурителите, OSHA, FAR договори бараат гео-означени, time-stamped фото дневници. Најевтин доказ што можеш да го произведеш.

### 4.3 NFC

- **Употреби:** GoCodes NFC Tracker (таг на алати со GPS по скан); myComply Smart Badge (пристап + сертификати); чек-пунктови.
- **Feasibility:** iOS само foreground (Core NFC); **Web NFC само Chrome/Android — НЕ на iOS, Firefox, десктоп**.
- **Издржливост:** Трајно но ниша — **QR кодовите (нула хардвер) ги покриваат повеќето потреби поедноставно**.

### 4.4 Камера / AR / LiDAR

- **Употреби:** LiDAR floor plans (SiteScape — инч-точност, export Revit/AutoCAD; Apple RoomPlan; magicplan + Xactimate); **документ скан**: Apple VisionKit (iOS 13+, вграден во ОС), Google ML Kit Document Scanner (Android, без camera permission, низок binary impact) — **cross-platform и бесплатно**.
- **Feasibility:** **LiDAR е само iOS** (iPhone 12 Pro+/iPad Pro). Android се потпира на ARCore camera depth; magicplan *го отстрани AR scanning-от на Android (крај 2024)* поради хардверска неконзистентност. AR точноста опаѓа на non-LiDAR уреди.
- **Издржливост:** Трајно но уред-фрагментирано; документ скан-от е commodity OS способност.

### 4.5 Сензори (акцелерометар/жироскоп/магнетометар)

- **Употреби:** level/plumb, ориентациска фото-фотографија, fall/no-motion детекција.
- **Feasibility:** Web Generic Sensor API е Chrome/Android-центричен, **го нема во Safari/Firefox**. Нативно: Core Motion / SensorManager.
- **Издржливост:** Периферно — "убаво за имање", не основно за документација.

### 4.6 Офлајн-first (задолжително)

- **Патерни:** Android **WorkManager** (network/charging Constraints, експоненцијален backoff); iOS **BGTaskScheduler** + URLSession background transfers; OS ги тротлира background задачите — дизајнирај за *opportunistic* sync. Web fallback: Service Worker + Background Sync (Chrome/Edge; **не Safari**).
- **Издржливост:** Задолжително. Фото апликација што не може да слика и да ги реди (queue) офлајн е мртва на терен.

### 4.7 Wearables

- **Употреби:** Apple Watch fall detection (вградена функција, **без апликациски развој**); Blackline G7c/G8 (fall/gas/GNSS/BLE/NFC/4G); Triax Spot-r + mesh + Procore.
- **Заклучок:** Fall detection е вграден — не гради watch app; само потроши HealthKit/Core Motion податоци ако сакаш fall-count контекст.

### 4.8 QR кодови (највисок ROI)

- **Употреби:** QR чек-пунктови за следење прогрес (QRTRAC); безбедносни документи, опрема, пристап, инспекции; **криптографски потпишани QR чек-пунктови** (Ed25519 потпис, офлајн верификација, фалсификати веднаш се откриваат, секој скан + ID + timestamp + GPS); QR/GPS check-in.
- **Feasibility:** Универзално: native (ML Kit Barcode / VisionKit), web-виабилно (BarcodeDetector/JS библиотеки). **Нула хардверски трошок** — печати на хартија/метал/водоотпорно.
- **Издржливост:** Трајно и **највисоко-ROI хардверска функција** за фото апликација — QR чек-пунктови даваат ефтин, безтрижен, верификуван запис за прогрес внатре каде GPS откажува.

### 4.9 Препорачан хардверски стек

1. **Основно (евтино, високо-вредно):** native app; фото со GPS + timestamp во EXIF; **QR чек-пункт скенирање**; офлајн-first ред со Wi-Fi-only upload; пинирање фотографии на план/мапа.
2. **Диференцијатори (средна цена):** документ скан (VisionKit/ML Kit — бесплатни OS API); LiDAR/AR мерења **само на iOS**; BLE поврзување со ласерски мерачи/термометри за логирани читања (native CoreBluetooth); Android-only beacon присуство.
3. **Чесно прескокни:** web-only BLE (нема Safari/iOS), Web NFC на iOS (невозможно), background beacon ranging на iOS (рестриктирано), survey-grade GPS (треба RTK хардвер), watch апликација (тангенцијално).
4. **Батерија:** background GPS/BLE троши — користи region monitoring, batch sync, charging-aware uploads.

---

## 5. Иновативни издржливи идеи (рангирани)

> Правило: **VLM (GPT-4o/Claude vision) за јазичниот слој** (класификација, структурирање, тагирање, сумирање, одговори) + **YOLO/SAM 2 за пикселниот слој** (детекција, сегментација, броење). **Никогаш не гради свои модели**; за фотограметрија — интегрирај (PIX4Dcatch / RealityCapture), не гради SfM. (Доказ: GPT-4V класифицира добро / локализира слабо — arXiv 2412.16108.)

| Ранг | Иновација | Зрелост | Трошок | Вердикт |
|---|---|---|---|---|
| **1** | **Voice-first фотација → структуриран запис** (глас + фото → пополнети полиња: тип работа, локација, issue, assignee, due date) | Докажано (OpenSpace Voice Notes: issues "up to 86% faster"; BuildPass, Zepth) | **2–4 недели** (Whisper API/MediaRecorder во mobile browser) | **Највисок** — отворена ниша: никој не направи voice+photo примарен циклус за работници со ракавици |
| **2** | **AI-напишани дневни извештаи/PDF** од фотографии + глас (VLM → структуриран JSON: труд, време, доцнења, инспекции, issues → постоечкиот PDF pipeline) | Докажано и преполно (BuildLog AI, Ruh AI, Crewlog; Procore/Raken го валидираат како table stakes) | **3–6 недели** | Висок — диференцијацијата е во тоа колку нацртот е врзан за *нашата* фото евиденција |
| **3** | **Sporedluvanje: same-viewpoint споредба на фотографии** (ghosting/overlay на претходната фотографија при повторно фотографирање на иста локација + диф) | Докажано со фиксни/360 камери; **недокажано со телефон — отворена можност** | **4–8 недели** (ghosting + мануелно порамнување); 10–14 со автоматско (homography) | **Висок и единствен диференцијатор** — phone-native одговор на категорија што инкумбентите ја решаваат само со хардвер |
| **4** | **VLM класификација на прогрес + човечка потврда** (фаза, материјали, инсталирани елементи → suggestion UI) | Докажан патерн (OpenSpace human-in-the-loop; DroneDeploy без BIM/сchedule) | **4–8 недели**; full %-complete-по-локација: 10–14 | Средно-висок — бара phone-photo агол за да се разликува |
| **5** | **Дефект детекција (popravka): VLM flagging + SAM 2** (означи "можна пукнатина/протекување" → човек потврдува → SAM 2 црта измерен контур по клик) | Емерџинг (PLOS One 2026: главно manufacturing; GPT-4V слаб во прецизна локализација) | **6–10 недели** | Среден — "flag-don't-measure", низок ризик како сугестија |
| **6** | **Фото → мерење (outline метод)** (означи елемент на фотографија → GPS-печатеа мерење, ±3% vs 15–20% рачен) | Докажана ниша (Deep Purple) | **4–6 недели** (v1) | Среден — про-тиер, очекувањата да се постават |
| **7** | **Волумен/фотограметрија** | Емерџинг; производни алатки постојат (PIX4Dcatch, RealityCapture, Reconstruct) | **12+ недели** (интеграција) | Средно-низок — тешко, чувствително на точност |
| **8** | **PPE/безбедносна детекција** | Докажано и комодитизирано (DroneDeploy Safety AI 95%, Evercam, WCCTV) | **3–6 недели** | Низок — без диференцијација, повикува обврски |
| **9** | **Image-to-BIM / предвидување доцнење** | Докажано само за мега-проекти (Buildots, nPlan — требаат големи податоци) | Реалистично за нас: **само schedule import + weather API** (4–6 недели) | Низок — не гради nPlan/Buildots конкурент |
| **10** | **IoT сензори, wearables, дронови, дигитални близнаци** | Докажано (Giatec SmartRock — 20,000+ градилишта; OpenSpace Air; DroneDeploy) | — | **Не гради; партнерирај/интегрирај подоцна** |

**Стратешка препорака:** прво изгради **voice + photo → структурирани податоци → авто-напишани извештаи** (ставки 1–2), па **same-viewpoint споредба** како диференцијатор (ставка 3), со VLM класификацијата како сврзно ткиво (ставка 4). Сè под ставка 4 е опционална подоцнежна фаза или интеграција.

---

## 6. Предложен Roadmap (фази)

> Основа: моменталната состојба на апликацијата (web-only, Next.js 16 + Supabase, RLS, service-role API слој) + познати празнини од аудитот (нема rate limiting, нема web CI, дел од RLS/RPC прашања, a11y). **Препорака: прво затвори ги аудит-празнините како предуслов, па фазите подолу.**

### Фаза 0 — Предуслови (1–2 недели, паралелно со Фаза 1)
- Rate limiting (Upstash/In-Memory) + Supabase auth подесувања
- Web CI (GitHub Actions: lint + typecheck + test)
- Поправка на RLS/RPC прашањата и audit_logs immutability
- a11y/UX закрпи од аудитот (DefectBoard, i18n fallbackAlt)

### Фаза 1 — Photo-first комуникација + брза интервенција (4–6 недели)
**Цел: фотографијата = порака.**
- [ ] **Анотирани фотографии како пораки** — markup/стрелки/кругови на фото (canvas overlay)
- [ ] **Пинирање на план/мапа** (фото → локација; autolocation по GPS)
- [ ] **@спомни одговорен по улога** + push известувања (FCM/APNs) + SMS fallback
- [ ] **Следење потврда + автоматска ескалација** (непотврдено за X време → ескалирај на надзорник / конвертирај во дефект)
- [ ] **WebSocket live фид** (кој е на терен, нови фотографии, нови анотации) — Raken Activity feed патерн
- [ ] **Офлајн-first ред** (Service Worker + Background Sync; опортунистички sync; Wi-Fi-only upload)
- [ ] **WhatsApp-слична нула-фрикција UX**: еден тап слика → еден тап ознака → еден тап ping; субизведувачи без сметка (линк за пристап)

### Фаза 2 — Телефонски можности (3–5 недели)
**Цел: искористи го хардверот што работниците веќе го носат.**
- [ ] **QR чек-пунктови** (највисок ROI): генерирање, скенирање, GPS + timestamp + фото по скан; криптографски потпис (Ed25519) за tamper-evidence
- [ ] **EXIF печат** (GPS + timestamp + проект) на секоја фотографија при upload/каптура
- [ ] **Geofence присуство** (влез/излез на градилиште → авто-check-in)
- [ ] **Документ скан** (VisionKit/ML Kit — бесплатни OS API)
- [ ] **(Нативно, ако се оди во PWA/App):** BLE ласерски мерачи/термометри со логирани читања; beacon присуство (Android); LiDAR/AR мерења (iOS, pro-tier)

### Фаза 3 — Издржливи иновации (6–10 недели)
**Цел: AI-слој кој произведува, не разговара.**
- [ ] **Voice-first фотација** (MediaRecorder + Whisper API → структуриран запис) — ранг 1
- [ ] **AI-напишани дневни извештаи** од фото + глас (VLM → JSON → PDF pipeline) — ранг 2
- [ ] **Same-viewpoint споредба** (ghosting/overlay + диф парови) — ранг 3 — *диференцијаторот*
- [ ] **VLM класификација + човечка потврда** (авто-тагирање, фаза на прогрес) — ранг 4

### Фаза 4 — Подоцнежни интеграции (по потреба)
- Дефект flagging + SAM 2 (ранг 5), фото→мерење outline (ранг 6)
- **Webhook out** (HMAC-SHA256) — фотографиите течат во Procore/ACC/Teams (интеграциски клин)
- Schedule import (P6/CSV) + weather API контекст
- WhatsApp in-chat bot (алтернативен канал за адопција)
- Live камери (EarthCam/TrueLook embed) како viewing слој

---

## 7. Извори (клучни)

**Топ 5 платформи:** Procore Q4/FY2025 резултати (feb 2026) · 10-K · Reddit r/ConstructionManagers · Autodesk ACC→Forma rebrand (24.03.2026) · Forma Build tiers (07.05.2026) · Capterra/G2/TrustRadius Forma прегледи · Fieldwire pricing/offline · Forbes Fieldwire преглед · Raken (contractortoolstack, Capterra, GetApp) · OpenSpace (contractortoolstack, RFP.wiki TCO, App Store, pricing) · 6sense пазарен удел (дирекциски).

**Live комуникација:** Procore Conversations / Incidents+Workflows · Fieldwire · Raken Dashboard/Live Views · Autodesk Issues+webhooks · USP Research 2025 (64% IM) · Velora AI (66% WhatsApp) · Confluence 2025 Tech Stack Survey · Zello · Teamwire · TRUCE Extend / ralco.ai (geofencing) · SALUS (acknowledgment) · Heed · EarthCam / DJI Dock 3 / TrueLook / OxBlue · OnStation (field app fatigue) · JBKnowledge ConTech Report · Valoon (in-chat адопција) · Sitewise (field-first) · Site Report Expert · Kraaft.

**Хардвер:** BeaconTrax · myComply · Hilti ON!Track · build-construct (connected tools) · testmuai (Web Bluetooth/NFC поддршка) · IEEE PLANS 2025 (dual-freq GNSS) · MDN Geolocation · PHOTO iD / BuildLog / Fieldly / SiteCam (гео-фото) · GoCodes NFC · Apple RoomPlan / SiteScape / magicplan / AR Plan 3D · ML Kit doc scanner / Apple VisionKit · MDN Sensor APIs · beefed.ai (offline-first) · Apple Watch fall detection · Great River Energy · Blackline / Triax · QRTRAC · MyProtektor (Ed25519 чек-пунктови) · qree.app.

**Иновации:** OpenSpace Field AI Voice Notes · BuildLog AI · Ruh AI · Crewlog · Deep Purple (фото→мерење) · PIX4Dcatch / RealityCapture / Reconstruct · SAM 2 (arXiv 2408.00714) · GPT-4V прогресс мониторинг (arXiv 2412.16108) · PLOS One 2026 VLM дефекти · DroneDeploy Safety AI / Progress AI · StructionSite · Giatec SmartRock · Buildots · nPlan · Trunk Tools TrunkText · TrueLook/OxBlue/Enlaps Tikee time-lapse.

---

## 8. Отворени прашања

1. 🤔 **PWA vs native app?** Фазите 1–2 се web-реализирани (Service Worker, MediaRecorder, QR скен); BLE/beacon/LiDAR бараат native (Expo/React Native или Swift/Kotlin). Кога е вистинскиот момент за native?
2. 🤔 **WhatsApp канал?** Да се гради in-chat бот како алтернативен канал за адопција, или само нула-фрикциска web UX?
3. 🤔 **Модел на цени:** unlimited-users (Procore модел) vs per-seat (Fieldwire модел) — со оглед дека брзата интервенција вклучува субизведувачи?
4. 🤔 **Приоритет на диференцијаторот:** same-viewpoint споредба (ранг 3) веднаш по Фаза 1, или после AI извештаите (ранг 2)?
5. 🤔 **Колку е реален интересот за гео-означени/верификувани дневници** (инспекции, осигурителни, рекламации) на македонскиот пазар — за да се одлучи дали QR/EXIF печат-от е фронт или бек карактеристика?
