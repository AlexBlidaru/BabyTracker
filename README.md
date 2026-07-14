Gemenii · Tracker — sinteză completă a proiectului
> Acest document e scris ca să poată fi înțeles de la zero, fără context anterior —
> inclusiv de un alt tool AI care preia lucrul la acest proiect. Descrie ce există,
> de ce există așa, ce bug-uri au fost găsite și reparate, și ce a fost eliminat
> intenționat.
Ce este
Aplicație web (PWA) de urmărire zilnică pentru gemeni: somn, alăptare/biberon/masă
solidă, scutece, activități diverse, creștere (greutate/înălțime/cap + poze),
medicamente (planuri recurente cu final configurabil), și statistici. Se
instalează pe telefon ca o aplicație (Add to Home Screen). Datele sunt comune
între ambii părinți — oricine deschide link-ul vede și modifică aceleași date, în
timp real, prin sincronizare cu un backend minimal pe Cloudflare.
Nu există cont de utilizator sau autentificare — oricine are link-ul citește și
scrie în aceleași date. E o alegere deliberată (simplitate), acceptabilă pentru
un link privat între doi părinți.
Arhitectură
```
public/
  index.html      → toate ecranele (Acasă, Jurnal, Creștere, Meds, Ansamblu, Setări)
  style.css       → design tokens, temă dark, fonturi Fraunces + Manrope
  app.js          → toată logica aplicației (un singur fișier, ~1800 linii)
  manifest.json   → PWA (nume, iconiță, culoare temă)
  icon.png        → iconița PWA generată programatic (nu e un asset extern)
functions/api/data.js → funcție serverless Cloudflare Pages (GET/POST) — citește
                        și scrie starea completă a aplicației într-un KV namespace
wrangler.toml     → configurare Cloudflare; conține legătura KV (binding "BABY_KV")
```
Fără build step. HTML/CSS/JS simplu, fără framework, fără bundler. Se
deployează direct ca site static + o funcție serverless, pe Cloudflare Pages.
Chart.js e încărcat de pe CDN extern (`cdnjs.cloudflare.com`) prin `<script>` tag
în `index.html`. Important: tot codul care folosește Chart.js verifică
`typeof Chart !== 'undefined'` înainte de a-l folosi și e învelit în try/catch —
dacă acel CDN e blocat (rețea, firewall, offline), restul aplicației funcționează
normal, doar graficele nu apar. Asta a fost sursa unui bug greu de diagnosticat
(vezi „Bug-uri găsite și reparate” mai jos).
Modelul de date (state)
Un singur obiect JS, salvat ca JSON. Structura:
```
state = {
  version: 2,
  babies: [
    { id:'a', name, color, birthDate },   // id-urile 'a'/'b' sunt FIXE, nu se schimbă niciodată
    { id:'b', name, color, birthDate },
  ],
  logs: {
    feeding:  [{ id, babyId, subtype: 'breastL'|'breastR'|'bottle'|'solid',
                 start, end, amountMl, breastMilk (bool, doar la bottle),
                 foodDesc (doar la solid), notes }],
    sleep:    [{ id, babyId, start, end, notes }],
    diaper:   [{ id, babyId, type: 'pipi'|'caca'|'ambele', time, notes }],
    growth:   [{ id, babyId, date, weightKg, heightCm, headCm,
                 photo (string base64 jpeg, redimensionată la max 900px lățime),
                 notes }],
    activity: [{ id, babyId, type: 'temperatura'|'tummytime'|'altele',
                 value, notes, time }],
    medPlans: [{ id, groupId (opțional — leagă 2 planuri "Ambele"), babyId,
                 name, doseText, intervalHours, startAt,
                 endType: 'never'|'date'|'count', endDate, maxDoses,
                 paused (bool), notes }],
    medDoses: [{ id, planId (null dacă e doză ad-hoc), babyId, name, doseText,
                 scheduledTime, time, notes }],
  },
  timers: {
    feeding: { [babyId]: { subtype, start } },   // cronometru activ, dacă există
    sleep:   { [babyId]: { start } },
  },
  updatedAt: <timestamp ms>,
}
```
Compatibilitate: la încărcare (local sau de pe server), `normalizeState()` umple
orice câmp lipsă cu valori implicite (util dacă cineva testează cu date vechi
dintr-o versiune anterioară a aplicației).
Sincronizare
Local: `localStorage`, cheia `babyTrackerGemeni_v2`.
Remote: `fetch('/api/data')` GET/POST către un Cloudflare KV namespace legat
prin binding-ul `BABY_KV` (configurat în `wrangler.toml`).
La orice modificare: salvare locală instant + push către server, cu debounce
de 450ms.
La pornire și la fiecare 20 secunde: se verifică serverul; dacă are o versiune
mai nouă (`updatedAt`) și nu e o salvare locală în curs, se aplică peste
starea locală.
Punctul din header arată starea: verde = sincronizat, galben = se salvează,
roșu = eroare de rețea/KV neconfigurat corect.
Diagnosticare: orice eroare JS necapturată (throw, promise respinsă)
declanșează o bandă roșie vizibilă sus, cu mesajul exact al erorii. A fost
adăugată explicit pentru că mai multe bug-uri anterioare erau complet tăcute
(nu se vedea nimic în UI, doar „nu se întâmplă nimic”).
Funcții — starea finală
Acasă (Dashboard)
Comutator sus: Bebe 1 / Bebe 2 / Ambele — se poate schimba și prin
swipe stânga/dreapta oriunde pe ecran (nu doar prin tap).
Fundal colorat: la selectarea unui singur copil, fundalul aplicației se
colorează cu nuanța lui (gradient, 70% intensitate pe primii 750px de sus,
revine treptat la fundalul standard). La „Ambele”, fundalul rămâne neutru.
Bandă „următoarele”: strip orizontal cu următoarele 3 administrări de
medicamente programate, arată și pentru cine (nume copil, sau „Ambele” dacă
e același medicament/oră la amândoi). Click pe orice element → te duce direct
în tab-ul Meds. Cele întârziate apar roșii.
Predicție somn: după minim 6 somnuri complete înregistrate per copil,
calculează fereastra medie de veghe (timp treaz între somnuri) și estimează
ora următorului somn. Sub acel prag, arată câte înregistrări mai sunt necesare.
Acțiuni rapide (6 butoane): Somn, Alăptare S, Alăptare D, Biberon, Masă
solidă, Altele. Somnul și alăptările sunt cronometre (pornesc/opresc, cu
sheet de confirmare la oprire unde poți ajusta ora de început/sfârșit).
Biberonul are bifă „Lapte matern”. Altele deschide un selector cu patru
tipuri: Temperatură, Scutece (cu sub-tip pipi/caca/ambele), Tummy time
(durată introdusă manual, fără cronometru), Altele (notă liberă). Acțiunile
se aplică simultan la ambii copii dacă „Ambele” e selectat sus.
Bară de cronometre active jos, deasupra navigării — arată timpul scurs
live, cu buton „OPREȘTE” pentru fiecare.
Astăzi: 2 cifre — mese/alăptări azi, somn total azi (scutecele au fost
scoase de aici intenționat, la cerere).
Jurnal (Timeline)
Listă cronologică a tuturor înregistrărilor (somn, mese, scutece, altele),
cu chipsuri de filtrare: Toate / Somn / Mese / Scutece / Altele.
Fiecare intrare arată numele copilului (nu doar un punct colorat).
Click pe orice intrare → editare completă (dată, oră/interval, tip, câmpuri
specifice tipului, notițe) + ștergere.
Creștere
Per copil: greutate, înălțime, circumferință cap, dată, poză opțională
(redimensionată client-side, salvată ca base64 direct în date — nu există
storage separat de fișiere).
Grafic de evoluție a greutății (Chart.js), cu degradare grațioasă dacă
biblioteca de grafice nu s-a putut încărca.
Intrări complet editabile și ștergibile.
Meds
Filtru de status sus: Active / Pauză-încheiate / Toate (implicit: Active).
Planuri recurente: nume, doză, interval în ore, prima doză (dată+oră), și un
final configurabil — fără limită, până la o dată, sau număr fix de
doze. La atingerea limitei, planul se marchează automat „Tratament încheiat”.
„Ambele” ca opțiune reală la creare — nu doar grupare vizuală: creează
două planuri identice legate printr-un `groupId` comun; pauză/editare/ștergere
acționează pe amândouă simultan; sunt afișate ca un singur card, nu duplicat.
Fiecare card are un dropdown inline de doze (nu un ecran separat): implicit
arată doar următoarele 3 doze nebifate; se extinde/restrânge cu o săgeată,
arătând la extindere toate dozele generate (trecute + viitoare) până la limita
planului, fiecare cu bifă. Bifarea/debifarea salvează/șterge instant o
înregistrare de administrare. Nu mai există un buton separat „Am administrat
acum” pe card — a fost eliminat, înlocuit complet de checklist.
Buton separat „Administrează acum” pentru doze ad-hoc, fără plan recurent.
„Calendar administrări”: agendă unificată (ultimele ~4 zile + următoarele 7
zile) cu tot ce s-a dat și ce urmează, indiferent de plan; dozele date cu
întârziere sau în avans arată „(programat X, administrat Y)”.
Ansamblu
4 grafice: Somn (ore/zi), Mese & alăptări (nr/zi), Scutece (nr/zi) — ultimele
7 zile, comparativ pentru ambii copii; Evoluție greutate (kg) — istoric
complet, ambele curbe suprapuse.
Setări
Mini-profil per copil: poză (din ultima măsurătoare de creștere), ultimele
valori, vârstă calculată din data nașterii.
Editare nume, culoare, dată naștere per copil.
Export/import backup complet ca `.json`.
Ștergere completă a datelor: buton intenționat mic și discret (nu un buton
roșu mare), cu două confirmări secvențiale, ca să nu se apese din greșeală.
Altele (comportamente generale)
Pull-to-refresh: tragi în jos oriunde pe ecran → resincronizare manuală.
Bandă de eroare vizibilă: orice eroare JS necapturată apare ca text roșu
sus, cu mesajul exact.
Funcție construită și eliminată intenționat
Linie de puls / referință bpm standard pe vârstă — arăta o valoare de tip
„~120 bpm” calculată din data nașterii, ca reper standard pentru vârstă (NU o
măsurătoare reală, era clar marcată ca atare). A fost eliminată complet la
cererea explicită a utilizatorului („ocupă spațiu degeaba”) — cod, HTML și CSS
șterse curat. Dacă cineva vrea să o readaugă: era o funcție `getStandardBpm(birthDate)`
cu praguri simple pe vârstă (nou-născut/sugar/1-2 ani/peste 2 ani) și un card
mic pe Acasă cu animație de puls. Nu exista niciun grafic live pentru ea — s-a
decis că un „grafic” al unei valori de referință statică nu ar adăuga informație
reală.
Bug-uri non-evidente găsite și reparate (context util pentru depanare viitoare)
Butonul „OPREȘTE” din bara de cronometre nu făcea nimic. Cauza: se
pasa un string simplu unei funcții care aștepta un array de id-uri de copii
(`babyIds.map(...)` eșua silențios pe un string). Reparat trecând mereu array-uri.
Măsurătorile de la Creștere „nu se salvau”. Cauza reală: dacă biblioteca
Chart.js nu se încărca (CDN blocat de firewall, testare locală fără net),
funcția de randare a Creșterii arunca o eroare la linia care desena graficul
și se oprea acolo — lista nu se mai actualiza vizual, deși datele chiar se
salvaseră (local + server) înainte de acel punct. Reparat cu verificări
`typeof Chart !== 'undefined'` + try/catch în jurul oricărei utilizări Chart.js.
Data nașterii nu se reflecta corect imediat. Cauza: `new Date("YYYY-MM-DD")`
se interpretează ca miezul nopții UTC, nu local — pentru cineva din România
(UTC+2/+3) puteau apărea calcule de vârstă temporar negative. Reparat prin
parsare manuală an/lună/zi și construire de dată locală.
Deploy eșuat pe Cloudflare — proiectul se crea inițial ca „Worker”, nu ca
„Pages” (interfața Cloudflare ascunde acest buton sub un link „Looking to
deploy Pages? Get started”, ușor de ratat).
Bindings KV blocate în dashboard — odată ce există `wrangler.toml` în
repo, Cloudflare dezactivează adăugarea manuală a binding-urilor din
dashboard („Bindings for this project are being managed through wrangler.toml”).
Legătura KV trebuie editată direct în `wrangler.toml`, pe GitHub, cu ID-ul
real al namespace-ului.
Deploy (Cloudflare Pages)
Proiect conectat la un repo GitHub, redeployează automat la fiecare push pe `main`.
Build settings: fără build command, Build output directory = `public`.
KV: namespace creat din Storage & databases → KV, legat prin `wrangler.toml`:
```
  [[kv_namespaces]]
  binding = "BABY_KV"
  id = "<id-ul real al namespace-ului>"
  ```
Fără chei API sau secrete necesare — singura dependență de „backend” e acest
binding KV.
Limitări cunoscute
Fără autentificare — oricine are URL-ul poate citi/scrie.
Fără notificări push reale pentru medicamente (trebuie deschisă aplicația ca
să vezi banda/checklist-ul).
Doar în limba română.
Pozele sunt stocate ca base64 direct în JSON-ul din KV — suficient la scară
mică; ar avea nevoie de storage extern (ex: Cloudflare R2) dacă volumul de
poze ar crește mult.
Stare la ultima interacțiune
Toate cerințele discutate au fost implementate; nu există elemente rămase
neterminate sau pe listă de așteptat.
