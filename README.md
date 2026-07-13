# Gemenii · Tracker

Aplicație de urmărire pentru gemeni: somn (cu predicție), alăptare/biberon/
mâncare solidă, scutece, activități, medicamente (planuri recurente +
calendar de administrări), creștere (greutate/înălțime/cap + poze cu
evoluție). Datele sunt **comune**: tu și partenerul/partenera vedeți
aceleași informații, pe telefoane diferite. Orice acțiune se poate aplica
și pentru amândoi copiii deodată (selectezi "Amândoi" din meniul de sus).

## 1. Deploy pe Cloudflare Pages (5 minute, gratuit)

### Pasul 1 — creezi un namespace KV (aici se salvează datele)
1. Intri pe [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **KV** (în meniul din stânga).
2. Apeși **Create a namespace**, îi pui un nume, ex: `baby-tracker-kv` → **Add**.

### Pasul 2 — urci proiectul
Cea mai simplă variantă, fără linie de comandă:
1. **Workers & Pages** → **Create** → tab **Pages** → **Upload assets**.
2. Dai un nume proiectului (ex: `gemenii-tracker`) și tragi peste folderul **`public/`** din acest proiect (doar conținutul lui, sau tot folderul — Cloudflare recunoaște structura).
3. Apeși **Deploy site**.

   *Dacă preferi să legi un repo Git (GitHub), poți face și asta din **Create → Pages → Connect to Git**; setează `public` ca "build output directory" și lasă build command gol.*

4. Pentru ca folderul `functions/api/data.js` (partea de server) să fie inclus, cel mai simplu e să urci **întregul folder al proiectului** (nu doar `public`), sau să folosești Git — Cloudflare Pages detectează automat folderul `functions/`.

### Pasul 3 — legi KV-ul de proiect
1. În proiectul tău Pages → **Settings** → **Functions** → **KV namespace bindings** → **Add binding**.
2. Variable name: `BABY_KV`
3. KV namespace: alegi cel creat la pasul 1.
4. Salvezi și faci un **redeploy** (Deployments → ... → Retry deployment), ca legătura să intre în vigoare.

Gata — accesezi URL-ul dat de Cloudflare (ex: `gemenii-tracker.pages.dev`) și aplicația funcționează, cu date comune pentru oricine deschide acel link.

## 2. Shortcut pe telefon (ca o aplicație reală)

- **iPhone (Safari):** deschizi linkul → butonul de Share (pătrățel cu săgeată) → **Add to Home Screen**.
- **Android (Chrome):** deschizi linkul → meniul (⋮) → **Add to Home screen** / **Install app**.

Icoana și numele ("Gemenii") sunt deja pregătite (`manifest.json` + `icon.png`).

## 3. Cum funcționează sincronizarea

- Fiecare modificare se salvează instant local pe telefon și se trimite către server (KV).
- La deschiderea aplicației și la fiecare 20 secunde, aplicația verifică dacă există date mai noi de pe alt telefon și se actualizează automat.
- Dacă nu ai semnal/internet, aplicația continuă să funcționeze offline (localStorage) și se sincronizează când revine conexiunea.
- Punctul din header (lângă titlu) arată starea: verde = sincronizat, galben = se salvează, roșu = eroare de conexiune.

## 4. Structura proiectului

```
public/            → tot ce vede browserul (HTML, CSS, JS, manifest, icon)
functions/api/data.js → endpoint-ul serverless (GET/POST) care citește/scrie în KV
wrangler.toml       → configurare opțională pentru deploy via linie de comandă (wrangler)
```

## 5. Backup

Din tab-ul **Setări** din aplicație poți exporta toate datele într-un fișier `.json`
(păstrează-l undeva sigur din când în când) și le poți reimporta oricând.
Ștergerea completă a datelor cere două confirmări explicite, ca să nu se
întâmple din greșeală.

## 6. Predicția de somn

După ce ai înregistrat cel puțin 6 somnuri complete (cu oră de început și
sfârșit) pentru un copil, pe Acasă apare un card "Predicție somn" care
calculează fereastra tipică de veghe (timpul mediu dintre somnuri) și
estimează la ce oră ar trebui să adoarmă din nou. Predicția se rafinează
automat pe măsură ce adaugi mai multe înregistrări.

## 7. Medicamente

Tab-ul **Meds** are două părți:
- **Planuri active** — medicamente administrate recurent (ex: la 8 ore).
  Poți crea un plan, pune pauză, edita sau șterge, și apeși "Am administrat
  acum" când dai o doză.
- **Calendar administrări** — un jurnal cu ce s-a dat deja și ce urmează în
  următoarele 7 zile; dozele întârziate sunt evidențiate.

Pentru o doză ocazională (fără plan recurent), foloseşte butonul
"Administrează acum".
