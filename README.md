## Versio 2.4 – aiempien päivien avaaminen ja tuntilistan tuonti

Valitse Tunnit tai Pamark ajolista. Avaa päivä -kohdassa valitse päivämäärä ja Pamarkille myös rekisterinumero. Avaa päivän tiedot palauttaa säilytetyn paikallisen luonnoksen tai tiedoston päiväkirjauksen. Näytä tallennetun tiedoston tiedot avaa tiedoston version myös silloin, kun lomakkeessa oli jo luonnos. Luonnos säilytetään erikseen ja palautuu Avaa päivän tiedot -painikkeella. Päivän tiedot näytetään tarkistusnäkymässä; Muokkaa avaa kentän valmiiksi täytettynä.

Tunnit-näkymän Tuo aloitettu tuntilista (.xlsx) tuo täytetyn alkuperäisen mallin mukaisen tiedoston sovellusmuistiin muuttamatta sen rakennetta. Tiedoston nimen sijaan kuukausi päätellään päiväriveistä. Kuljettajan nimen tulee vastata omaa nimeä. Jos saman kuukauden paikallinen lista sisältää jo eri kirjauksia, tuonti pysäytetään niiden suojaamiseksi. Tuotu tuntilista tallennetaan sovellusmuistiin; kopion voi viedä XLSX-painikkeella.

Pamarkin avaaminen käyttää Google-yhteyden ollessa käytettävissä jaettua tiedostoa ja yhdistää lähettämättömät paikalliset kirjaukset paikalliseen kopioon. Offline-tilassa tarvitaan aiemmin haettu kopio. Päivän avaaminen ei lähetä päiväkirjauksia; siihen käytetään edelleen Synkronoi-painiketta.

Pura jakelupaketti GitHub-repositorion juureen ja korvaa samannimiset tiedostot. Sulje sovellus päivityksen jälkeen ja avaa uudelleen verkkoyhteydessä. Älä tyhjennä selaimen tallennustietoja.

## Versio 2.3.2 – synkronoinnin ohjaus

Synkronointipainike kertoo nyt tarvittavan seuraavan vaiheen: yhteyden valmistelu, Google-kirjautuminen, kansion valinta tai synkronointi. Pelkkä luonnos ei ole lähetysjonossa: paina ensin Tallenna puhelimeen. Yhteyden ja kansion muutokset päivittyvät näkymään. Sisältää myös version 2.3.1 kansiokorjauksen.

## Versio 2.3.1 – puhelimen kansio-oikeuden korjaus

Jos selain estää paikallisen kansion käytön, sovellus siirtyy sovellusmuistiin. Kirjaukset säilyvät paikallisesti, ja Pamarkin Drive-haku ja synkronointi toimivat edelleen. Kansion voi valita uudelleen asetuksissa. Päivityksen jälkeen sulje sovellus ja avaa uudelleen. Älä tyhjennä selaimen tietoja.

# Päivitys 2.3 – Pamarkin tiedosto avataan Drivestä

1. Valitse **Pamark ajolista**. Sovellus etsii kirjauksen päivämäärää vastaavan puolikuukauden tiedoston kerran valitusta jaetusta Drive-kansiosta.
2. Jos Google-yhteys puuttuu, avaa **Google-yhteys ja jaettu kansio**. Kirjaudu ja valitse Ajolistat-kansio. Valinnan jälkeen tiedosto haetaan automaattisesti. Kirjautumista on ajoittain uusittava, koska Google-tunnusta ei tallenneta pysyvästi.
3. Löytynyt ajolista tallennetaan paikalliseksi työversioksi. Jos tiedosto puuttuu, se luodaan automaattisesti sovelluksen pohjasta. Luonti lähettää vain tyhjän jakson pohjan ja ajoneuvoasetukset, ei omia lähettämättömiä ajopäiviä.
4. Valitse auton rekisterinumero ja päivämäärä. Jos niille löytyy jo päivärivi ja lomake on vielä tyhjä, rivin tiedot avautuvat automaattisesti. Keskeneräistä omaa lomaketta ei korvata.
5. **Tallenna puhelimeen** tallentaa päivän paikallisesti. **Synkronoi** lähettää ajokirjaukset Driveen päivän päätteeksi.

Verkkokatkossa käytetään aiempaa paikallista kopiota. Jos sitä ei ole, voit kirjata päivän luonnokseksi ja tallentaa paikallisen tiedoston mukana tulevasta pohjasta. Oikea Drive-versio haetaan ja tiedot yhdistetään myöhemmin.

Haku säilyttää jonossa olevat lähettämättömät päivät. Jos niiden kohdalla on erilainen jaettu kirjaus, haku pysähtyy eikä paikallista tiedostoa korvata. Useat samannimiset tiedostot, väärä jakso tai väärä taulukkomuoto pysäyttävät haun. Pelkkää tiedoston valintaa ei enää tarvita tavallisessa täyttämisessä; omat pohjat vaihdetaan tarvittaessa asetuksissa.

Tuntilista toimii edelleen vain paikallisesti. Oikea kuukausitiedosto avataan tai luodaan Tunnit-valinnalla.

**Päivittäminen:** pura ZIP ja lataa kaikki tiedostot GitHub-repositorion juureen korvaten samannimiset. Älä poista sivuston paikallisia tietoja. Julkaisun jälkeen sulje vanhat sovellusikkunat ja avaa uudelleen verkossa. Asetuksissa näkyy versio **2.3**.

Testattu paikallisesti: olemassa olevan tiedoston haku, puuttuvan tiedoston luonti, päivärivin avaus, keskeneräisten päivien säilyminen, ristiriidat, verkkokatkot ja Pagesin offline-polut. Oikeaa Google-tiliä ei käytetty testeissä.

---

# Tunnit ja Pamark – puhelimessa toimiva sovellus

Tämä versio toimii kokonaan selaimessa. Ei omaa palvelinta, Node-asennusta puhelimeen, maksullista julkaisupalvelua eikä sovelluksen käyttäjätilejä. GitHub Pages jakaa vain sovelluksen tiedostot. Aloituksessa valitaan nimi ja molemmille listoille yhteinen tallennuspaikka. Tuetussa selaimessa valitaan paikallinen kansio; muissa valitaan sovelluksen paikallinen muisti. IndexedDB säilyttää lisäksi luonnokset ja työkopiot.

## GitHub Pages käyttöön

1. Pura **Ajolista-GitHub-Pages.zip** tietokoneella.
2. Lataa ZIP:n **kaikki tiedostot** repositorion `Temppa82/Tunnit` juureen. Tässä paketissa ei ole alikansioita. Korvaa samannimiset tiedostot, myös `index.html` ja `sw.js`. ZIP-tiedoston lataaminen sellaisenaan ei riitä.
3. GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
4. Valitse **main** ja **/(root)**, sitten **Save**.
5. Odota julkaisua. Osoite on **https://temppa82.github.io/Tunnit/**, kun julkaisu valmistuu. Jos käytät muuta repositorion nimeä, osoitteen loppu vaihtuu.

GitHubiin tuleva valmis paketti ei tarvitse koontikomentoja tai GitHub Actions -asetuksia. Vanhan version Node-palvelinta ei käynnistetä. Sen lähdekoodit voivat jäädä repositorioon, mutta käytössä on uusi valmis index.html. Älä lataa omia listapohjia tai täytettyjä XLSX-tiedostoja julkiseen repositorioon.

## Asenna puhelimeen

Avaa Pages-osoite ensin verkkoyhteydessä ja odota tekstiä **Valmis offline-käyttöön tällä laitteella**.

- Android / Chrome: selaimen valikko → **Asenna sovellus** tai **Lisää aloitusnäyttöön**.
- iPhone / Safari: Jaa → **Lisää Koti-valikkoon**.

Avaa asennettu sovellus kerran verkossa myös sen omasta kuvakkeesta ja tarkista offline-ilmoitus. Tämän jälkeen kirjaukset ja tiedostojen muodostaminen toimivat ilman nettiä. Vain Drive-kirjautuminen ja synkronointi tarvitsevat verkon. ZIP:n index.html:n avaaminen suoraan Tiedostot-sovelluksesta ei asenna PWA:ta.

## Ensimmäinen käynnistys

Kirjoita kuljettajan etu- ja sukunimi sekä valitse tallennuspaikka:

- Tuettu selain (esim. Chrome Androidilla): **Valitse paikallinen kansio** – molemmat listat kirjoitetaan suoraan valittuun kansioon.
- Muu selain/puhelin: **Käytä sovelluksen paikallista muistia** ja vie kopiot erikseen **Vie XLSX** -painikkeella.

Valitse lisäksi alkuperäiset kaksi listapohjaa: tuntilistaan **Tuntilista Teemu.xlsx** ja Pamarkiin yrityksen alkuperäinen Pamark-pohja. Kun painat **Luo puuttuvat listat ja aloita**, sovellus luo automaattisesti puuttuvan tämän kuukauden tuntilistan ja kuluvan puolikuukauden Pamark-listan. Asetukset → **Tallennuskansio ja listapohjat** vaihtaa tallennuspaikan myöhemmin.

## Päivittäinen käyttö

1. Valitse **Tunnit** tai **Pamark ajolista**.
2. Täytä kysymykset. Päivämäärä on automaattinen ja muutettavissa. Voit jatkaa myöhemmin ja vaihtaa listojen välillä.
3. Paina **Tallenna puhelimeen**. Tämä ei ota Google-yhteyttä eikä lähetä tietoja verkkoon.
4. Avaa **Tallennetut listat**, kun haluat viedä XLSX-kopion puhelimen Tiedostot-sovellukseen tai latauksiin. Sovellusmuisti ja Tiedostot-kansio ovat eri asioita.
5. Päivän lopussa avaa **Synkronoi Pamark Driveen** ja paina **Synkronoi**. Tuntilistaa ei lähetetä Driveen.

Esimerkit: 15.9.2026 → `Pamark ajolista syyskuu 1-2 2026.xlsx`; 21.9.2026 → `Pamark ajolista syyskuu 2-2 2026.xlsx`. Jakso määräytyy kirjauksen päivämäärästä.

## Tiedostojen nimeäminen

- **Tuntilista:** `Tuntilista_<etunimi><kk><vvv>.xlsx`, esimerkiksi `Tuntilista_Teemu0926.xlsx`. Vanhan version samalla koko nimellä tallennettu tuntilista siirretään uuden nimen käyttöön kopiona; vanhaa tiedostoa ei poisteta. Jos saman etunimen tiedosto kuuluu eri kuljettajalle, sitä ei korvata.
- **Pamark ajolista:** `Pamark ajolista <kuukausi> <jakso>-2 <vuosi>.xlsx`, jossa jakso on **1** päivinä 1.–15. ja **2** päivinä 16.–kuun loppu. Esimerkiksi 23.9.2026 → `Pamark ajolista syyskuu 2-2 2026.xlsx`.

## Google-yhteys kerran laitetta kohti

Käytä olemassa olevaa Google Cloud -projektiasi. Drive API ja Picker API pitää olla käytössä.

Google Cloudissa lisää OAuth-asiakkaan **Authorized JavaScript origins** -kohtaan `https://temppa82.github.io` (ilman `/Tunnit/`-polkua). Rajaa Picker-avaimen verkkoviittaajat käyttämääsi sivustoon sekä Pickerin tarvitsemaan `https://docs.google.com/*`-osoitteeseen. Huomioi OAuth-sovelluksen testikäyttäjät, jos sovellus on testitilassa.

Sovelluksen **Synkronoi Pamark Driveen → Google-yhteyden asetukset**:

- OAuth-asiakastunnus: aiempi `…apps.googleusercontent.com`-tunnus.
- Google Picker API -avain: olemassa oleva selainavain.
- Google-projektin numero: projektin numeerinen tunniste.

Paina **Tallenna yhteysasetukset → Valmistele Google-yhteys → Kirjaudu Googleen → Valitse jaettu Drive-kansio**. Valitse Ajolistat-kansio. Nämä asetukset tallennetaan vain laitteelle, eikä niitä tarvitse julkaista GitHubissa. OAuth client secret -salaisuutta ei käytetä. Kirjautuminen on ajoittain uusittava.

## Miten muiden kirjaukset säilyvät

Synkronointi hakee jaetun kansion oikean XLSX:n ja etsii oman rivin rekisterinumeron sekä päivämäärän perusteella. Se yhdistää päivän tiedot ladattuun uusimpaan tiedostoon; puhelimen koko paikallista tiedostoa ei lähetetä suoraan vanhan päälle. Alkuperäiset kaavat, ulkoasu ja muiden päivien/autojen solut säilyvät.

Tallennuksessa käytetään Drive-tiedoston versiota (`If-Match`). Jos joku tallensi välissä, sovellus hakee uuden version ja yrittää yhdistämistä uudelleen. Jos samalla autolla ja päivällä on erilainen kirjaus, synkronointi pysähtyy ja oma kirjaus säilyy puhelimessa. Paikallinen korvauspainike ei anna lupaa korvata jaettua ristiriitaista riviä.

Puuttuva jakson tiedosto luodaan automaattisesti. Drivessä tiedostonimi ei ole yksilöllinen: jos kaksi puhelinta luo jakson aivan samanaikaisesti, kansioon voi syntyä kaksi tiedostoa. Sovellus tunnistaa useat samannimiset tiedostot ja pysäyttää synkronoinnin poistamatta tai korvaamatta kumpaakaan. Tarkista ja yhdistä kopioiden sisältö ennen jatkamista. Tavallinen olemassa olevan tiedoston päivitys käyttää version tarkistusta.

Katkon jälkeen odottavat kirjaukset lähetetään uudella Synkronoi-painalluksella. Virheessä niitä ei merkitä onnistuneiksi. Lopuksi sovellus lataa tiedoston uudelleen ja tarkistaa oman kirjauksen. Paikallinen XLSX sisältää omat paikalliset kirjaukset; Drivessä oleva yhteinen XLSX sisältää myös muiden kirjaukset.

## Ajoneuvot

Asetukset → **Ajoneuvot** → rekisterinumeropainike avaa auton kulutus- ja päästötiedot. Lähde: käyttäjän toimittama Pamark ajolista syyskuu 1-2 2026.xlsx, auton otsikkorivin E-, G- ja I-solut.

| Auto | Kulutus l / 100 km | CO₂-kerroin g/ltr (pohjan yksikkö) |
|---|---:|---:|
| JTS-790 | 24 | 0,13 |
| LLT-265 | 27 | 1,2 |
| FOM-995 | 12 | 0,13 |
| ZLC-613 | 27 | 0,13 |
| MTY-164 | 27 | 0,13 |
| ENR-210 | 27 | 1,2 |

Arvot ja yksikkö on kopioitu mallista; ne eivät ole ulkopuolisesta lähteestä varmennettuja päästökertoimia. Hintatietoja ei käsitellä.

**Tallenna asetukset ja päivitä paikallinen lista** tallentaa auton arvot ja päivittää valitun päivämäärän jakson paikallisen Pamark-listan. Puuttuva lista luodaan. Uudet jaksot saavat tallennetut arvot automaattisesti.

**Päivitä tämän auton tiedot Drive-ajolistaan** päivittää vain valitun auton kulutus- ja päästötiedot ja niiden kaavat jo olemassa olevaan jaettuun tiedostoon. Se käyttää version tarkistusta ja tarkistaa päivityksen lopuksi. Google-yhteys ja kansio valitaan tavallisessa Synkronoi Pamark Driveen -kohdassa. Normaali ajokirjausten synkronointi jättää olemassa olevan jaetun tiedoston ajoneuvoasetukset ennalleen. Näin toisen kuljettajan vanhat asetukset eivät palaudu joka päivä.

Päivityksen jälkeen sulje sovelluksen vanhat välilehdet/ikkunat ja avaa se uudelleen verkossa. Älä tyhjennä sivuston tallennettuja tietoja.

## Hyvä tietää

- Säilytä kopio tärkeistä XLSX-listoista myös Tiedostot-sovelluksessa. Selaimen tietojen poistaminen tai sovelluksen poisto voi poistaa paikallisen muistin. Sovellus pyytää pysyvää tallennustilaa, mutta selain päättää sen myöntämisestä.
- Tiedot eivät siirry automaattisesti vanhasta chatgpt.site-osoitteesta GitHub-osoitteeseen.
- Synkronoitavan tiedoston muoto on XLSX. Googlen oma natiivi Sheets-tiedosto on eri tiedostotyyppi, eikä tätä korvata.
- Alkuperäisiä taulukkopohjia ei muuteta.
- Koonti, alkuperäisten pohjien säilyminen ja synkronoinnin ristiriitatilanteet testataan paikallisesti. Oikea Google-yhteys sekä Android/iPhone-asennus on vielä varmistettava omilla laitteilla ja tunnuksilla.

## Lähdekoodi kehittäjälle

Erillinen lähdekoodipaketti on muokkaamista varten. Siinä `npm ci` ja `npm run build` muodostavat julkaistavan `dist`-kansion. Käyttäjän ei tarvitse asentaa Nodea tai suorittaa näitä komentoja. Valmis Pages-ZIP sisältää jo koostetun sovelluksen.