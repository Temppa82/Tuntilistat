## Versio 2.8 – tuntilistan tuonnin yhdistäminen (25.9.2026)

Korjattu syy: tuntilistan tuonti keskeytyi kokonaan, kun puhelimella oli jo kyseisen kuukauden kirjauksia. Viesti "Tämän kuukauden tuntilista sisältää jo paikallisia kirjauksia. Tuontia ei tehty, jotta ne eivät korvaudu" oli lopullinen este: mitään ei voitu tuoda, eikä mitään painiketta tarjottu. Seurauksena kuukausilista jäi vain puhelimella kirjattu päivä, vaikka tuotava tiedosto oli täytetty.

Nyt tuonti **yhdistää** päivittäin eikä koskaan hylkää kokonaisuutta. Päivät, joita puhelimella ei ole, tulevat tiedostosta. Päivät, joita puhelimella on, kirjoitetaan vain tiedoston arvoilla jos ne eroavat – ja tällöin tuonnin jälkeen näytetään luettelo päivistä, joita **ei** korvattu, sekä painike "Korvaa puhelimen kirjaukset", jolla ratkaisu tehdään tietäen. Puhelimella olevaa päivää ei koskaan pudoteta tuonnin yhteydessä, ei edes vahvistetussa korvauksessa. Jos kuukausilistaa ei ole vielä ollut, tuotava tiedosto otetaan sellaisenaan ilman uudelleenkirjoitusta.

Vahvistettu käyttäytyminen: ensimmäinen tuonti säilyttää tiedoston tavumuiseen asti. Myöhempi tuonti tuo uudet päivät, raportoi erilaiset päivät ilman korvausta, säilyttää puhelimen arvon, ja vasta vahvistuksen jälkeen kirjoittaa tiedoston arvot – puhelimella oleva toinen päivä säilyy myös siinä.

Testattu: päivittäinen yhdistäminen oikeilla tuntilistoilla, puhelimen oman päivän säilyminen tuonnissa, ristiriidan raportointi ilman kirjoitusta, vahvistettu korvaus ilman päivän pudottamista, sekä koko TypeScript- ja XLSX-testisarja. Varmistamatta: oikea Google-tili ja jaettu kansio, koska Drive-vastaukset simuloitiin.

Päivitys: pura ZIP ja lataa sen tiedostot GitHub-repositorion juureen korvaten samannimiset. Avaa päivitys verkkoyhteydessä ja sulje vanhat sovellusikkunat. Asetuksissa näkyy versio 2.8. Paikalliset kirjaukset ja asetukset säilyvät.

---

## Versio 2.7 – ristiriitaisen päivän avaamisen korjaus (25.9.2026)

Korjattu syy: kun päivän lähettämätön kirjaus ei sovi jaetun tiedoston riviin, synkronointi ilmoitti "Tälle päivälle on jo erilinen kirjaus" – ja sitten **myös päivän avaaminen kaatui samaan virheeseen**. Päivän avaaminen yhdisti lähettämättömän kirjauksen ladattuun kopioon ilman suojausta, joten kuljettaja ei päässyt vertaamaan tiedoston riviä eikä rakentamaan omaa kirjaustaan sen päälle. Ohje "avaa päivä tiedostosta ja yhdistä oma kirjaus" ei siis toiminut juuri siinä tilanteessa, jota se koskee.

Nyt avaaminen ei pysähdy: ristiriitainen kirjaus jätetään pois päivän näkymästä, se kerrotaan käyttöliittymässä selvästi, ja kirjaus jää tallennusjonoon koskemattomana mukaan myöhempään tarkistukseen. Toinen korjaus: tallennus ei enää pyyhki luonnoksen omaa vertailutietoa epäonnistuneen työn vanhalla tiedolla, joten tiedoston version päälle koottu kirjaus todella synkronoidaan.

Vahvistettu käytännössä: epäonnistuneen synkronoinnin jälkeen päivä avautuu, lomake perustuu jaetun tiedoston riviin, ja sille kootu uusi kirjaus synkronoidaan. Samalla varmistettu, ettei toisen kuljettajan arvo katoa: korvauksessa säilyvät tiedoston rivin kentät, joita oma kirjaus ei koske.

Testattu: uusi regressiotesti "failed sync no longer blocks opening the day" oikealla lähdetiedoston kopiolla, vanha testi päivitettiin vaatimaan uuden käyttäytymisen, sekä koko TypeScript- ja XLSX-testisarja. Varmistamatta: oikea Google-tili ja jaettu kansio, koska Drive-vastaukset simuloitiin.

Päivitys: pura ZIP ja lataa sen tiedostot GitHub-repositorion juureen korvaten samannimiset. Avaa päivitys verkkoyhteydessä ja sulje vanhat sovellusikkunat. Asetuksissa näkyy versio 2.7. Paikalliset kirjaukset ja asetukset säilyvät, ja jonossa oleva ristiriitainen kirjaus säilyy puhelimella.

---

## Versio 2.6 – Drive-synkronoinnin version ehdon korjaus (25.9.2026)

Korjattu syy: versio 2.5 lähetti `If-Match`-ehdon myös ajolistan **lataukselle**. Driven media-endpoint vertaa ehtoa tiedoston sisältö-eTagiin, joka eriää `files.list`-haun metatieto-eTagista, joten jokainen synkronointi pysähtyi vastaukseen 412 eli "Jaettu ajolista muuttui samaan aikaan". Uudelleenyritys ei auttanut, koska sama ehto hylättiin joka kerta. Lataus on nyt tavallinen luku, ja atomiversioehto on vain kirjoituksessa.

Vahvistettu käytännössä: kirjoitus hakee eTagin juuri ennen tallennusta `files.get`-kutsulla eikä käytä `files.list`-haun arvaa, koska vain ensimmäinen on taattu vertailtavaksi. Ehto on edelleen voimassa ja estää muiden kuljettajien rivien ylikirjoituksen. Jos Google hylkää saman eTagin kahdesti peräkkäin, synkronointi ilmoittaa sen kerran sen sijaan, että toistaisi saman epäonnistumisen, eikä jaettua tiedostoa muuteta lainkaan. Virheilmoitus kertoo nyt, kosteessa 412 tuli.

Testattu: simuloidulla Drivellä version 2.5 ehto, version ehto hylättynä kahdesti, uudelleenyritys aidon ristiriidan jälkeen, toisen kuljettajan säilyminen, saman rivin ristiriidan torjunta, tiedoston luonti, duplikaatin torjunta, offline-varakansio sekä koko TypeScript- ja XLSX-testisarja. Varmistamatta: oikea Google-tili ja jaettu kansio, koska Drive-vastaukset simuloitiin.

Päivitys: pura ZIP ja lataa sen tiedostot GitHub-repositorion juureen korvaten samannimiset. Avaa päivitys verkkoyhteydessä ja sulje vanhat sovellusikkunat. Asetuksissa näkyy versio 2.6. Paikalliset kirjaukset ja asetukset säilyvät.

---

## Versio 2.5 – päivän tiedonkulun korjaus (25.9.2026)

Pura ZIP ja lataa sen tiedostot suoraan GitHub-repositorion juureen korvaten samannimiset. Paketti sisältää litteän GitHub Pages -julkaisun. Asetuksissa näkyy versio 2.5. Avaa päivitys verkkoyhteydessä ja sulje vanhat sovellusikkunat, jotta uusi offline-versio pääsee käyttöön. Paikalliset kirjaukset ja asetukset säilytetään.

Korjatut syyt:
- Oikean Pamark-pohjan tyhjillä reittiriveillä on `Reitti:`. Vanha tunnistus piti niitä varattuina; samaa tallennusrivin hakua käytettiin myös pelkkään päivän lukemiseen. Nyt lukeminen ei vaadi vapaata riviä, ja tyhjä otsikko sekä laskentakaavat eivät varaa päivää. Täysi ja puutteellinen osio erotetaan.
- Täytetty luonnos esti tiedoston tietojen avaamisen ilman ilmoitusta. Nyt ero näytetään kentittäin ja valitaan jatkettava versio. Auton vaihto avaa erillisen luonnoksen; se ei muuta vain rekisteritunnusta vanhan kirjauksen päälle.
- Drive-synkronoinnista puuttui avaamishetken rivivertailu, joten myös oma korjaus torjuttiin. Nyt avattu rivi kulkee luonnoksen mukana. Uusin Drive-tiedosto luetaan, vain oma muuttumaton rivi päivitetään ja koko tiedoston samanaikainen muutos suojataan version ehdolla. Muuttunutta omaa riviä ei ylikirjoiteta.
- Kansion vanha tiedosto saattoi korvata sovellusmuistin uudemman, kansioon kirjoittamattoman työkopion. Työkopio säilytetään nyt ensisijaisena ja ero pysäyttää kansion korvaamisen.
- Jaetun Excel-kaavan jatkosolu tunnistetaan kaavaksi myös ilman omaa kaavatekstiä. Päiväkirjaukset ja uusien jaksojen luonti säilyttävät pohjan kaavat.

Testattu oikeiden tiedostojen erillisillä kopioilla:
- `Pamark ajolista syyskuu 1-2 2026.xlsx`: todelliset kuusi auto-osiota, Excel-päivämäärät, sekä tekstinä että numeroina olevat ajat ja tyhjät Reitti-rivit.
- `Tuntilista Teemu.xlsx`: 28 päiväriviä, kolme sairauspäivää ja aloitettu työpäivä maaliskuussa 2025. Vanha hours.xlsx-testikopio on SHA-256-tarkistuksella sama tiedosto. Käyttäjä vahvisti rakenteen nykyiseksi; vanhoja kirjauksia ei käytetä uuden kuukausilistan sisältönä.
- Olemassa olevien päivien avaaminen, uuden päivän lisäys, korjaus ja uudelleenluku, 15./16. päivän tiedostonimi, 25.9. kirjaus jälkipuoliskoon, aidosti täysi osio ja rikkinäinen rakenne.
- Tuntilistan tuonti tavuntarkasti sekä tallennus/vienti: alkuperäiset neljä päivää säilyivät ja uusi viides päivä lisättiin. Kaavat, tyylit ja muut XLSX-paketin osat tarkistettiin.
- Oikea Edge-selaintesti erillisessä testiprofiilissa: Pamarkin kenttien avaus, auton/listan vaihto, luonnosristiriidan valinta, paikallinen korjaus sekä sivun sulkeminen ja uudelleenavaus.
- Julkaisuversio Edge-selaimessa: tuntilistan paikallinen tallennus ja XLSX-lataus sekä sulkeminen/uudelleenavaus ilman verkkoa toimivan service workerin avulla.
- Simuloitu Drive käyttäen oikean XLSX:n kopiota: oman olemassa olevan rivin korjaus, saman rivin seuraava korjaus synkronoinnin jälkeen, muiden kuljettajien säilyminen, samanaikaisen koko tiedoston muutoksen uudelleenyritys ja saman rivin ristiriidan torjuminen ilman lähettämistä. Lisäksi aiemmat Drive-, kansiolupa-, tuonti-, vienti- ja offline-testit sekä TypeScript-tarkistus ja julkaisuversio menivät läpi.

Varmistamatta: oikean Google-tilin kirjautuminen, jaetun Drive-kansion todellinen luku/kirjoitus ja käyttöoikeudet; Androidin ja iPhonen fyysiset laitteet; Excelin oma kaavojen uudelleenlaskenta. Drive-testeissä verkkovastaukset simuloitiin. Tuotannon ajolistoihin ei tehty testikirjauksia. Pohjan olemassa olevia kaavavirheitä ei korjata tässä päiväkirjauksen muutoksessa.

Tallenna puhelimeen säilyttää työkopion kansiossa tai sovellusmuistissa ja kertoo käytetyn paikan. Synkronoi lähettää vain Pamark-kirjaukset. Tuntilista pysyy paikallisena. Vanhoilta luonnoksilta voi puuttua turvallisen Drive-korjauksen vertailutieto: avaa silloin tiedoston päivä ja tee korjaus sen pohjalta; vanha luonnos säilyy erikseen.

---

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
