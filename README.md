## Versio 2.11.0 – vakaa GitHub Pages -julkaisu (26.9.2026)

Julkaisuun liittyvä korjaus: sovellus ei voinut päivittyä Github Pagesilla luotettavasti, koska tiedostonimet vaihtuivat joka rakennuksessa (`index-a1b2c3.js`). Selain saattoi palvella vanhasta välimuistista vanhan JavaScriptin, vaikka käyttäjä oli jo avannut sivun uudelleen. Nyt buildi tuottaa aina samat nimet `index.js` ja `index.css`, joten päivitys otetaan käyttöön heti eikä tiedostoja tarvitse arvata uudelleen.

Välimuistiin liittyvä korjaus: service worker haki asennuksen yhteydessä resurssit vanhasta välimuistista ja jätti vanhan version voimaan. Asennus hakee nyt verkkosisällön ohituskutsulla (`cache: 'reload'`), uusi service worker otetaan käyttöön odottamatta (`skipWaiting`) ja se ilmoittaa olevansa ohjaamassa sivua (`clients.claim()`). Aktivoitu palvelin poistaa myös kaikki vanhat, eri versioiden välimuistit. Seurauksena päivitys näkyy heti myös silloin, kun sivu oli auki ennen päivitystä.

Rakennus versioiin sidotu: `package.json`, sovelluksen `APP_VERSION` ja service workerin välimuistin nimi nostetaan nyt samaan muotoon `x.y.z`, ja rakennus pysäyttää itsensä, jos ne eivät täsmää. Tällöin palvelin hakee aina juuri julkaistun rakennuksen. Tiedostoon kirjoitetaan myös rakennuspäivämäärä.

Korjattu lisäksi: koko käyttöliittymän suomenkieliset tekstit olivat tallentuneet kaksinkertaisesti UTF-8-koodattuina, mikä rikkoi painikkeiden ja otsikoiden tekstin. Tämä kiertää nyt rakennuksen yhteydessä ajettavalla tarkistuksella, joka pysäyttää buildin ennen julkaisua, jos koodausvirhe löytyy.

Nimeäminen: tuntilistan tiedostonimi on nyt pyydetussa muodossa eli `Tuntilista <etunimi><kk><vvv>.xlsx`, esimerkiksi `Tuntilista Testi0926.xlsx`. Aiempi muoto `Tuntilista_<etunimi><kk><vvv>.xlsx` siirtyy uuteen muotoon automaattisesti: sisältö säilyy, ja vanha talletettu nimi poistetaan vasta uuden onnistuttua, joten sama kuukausi ei näy kahdesti. Kansioon tallennettua vanhaa tiedostoa ei poisteta. Mitään kirjausta ei siirretty muualla kuin nimen muutoksesta, ja saman etunimen toiselle kuljettajalle kuuluvaa tiedostoa ei korvata.

Nimenvaihdossa oli ensin virhe, joka esti valmiin tuntilistan avaamisen: päivälehtiö ja XLSX-vienti etsivät tiedostoa ainoastaan uuden nimen avulla, joten puhelimella vanhan nimen alla oleva lista näkyi puuttuvana, vaikka se oli tallessa. Nyt kaikki lukupaikat hyväksyvät myös vanhan nimen, joten päivälehtiö löytää valmiin listan heti. Lukeminen ei poista mitään; tallennus siirtää vanhan nimen uudeksi. Korjaus on testattu selaimessa tilanteessa, jossa puhelimella on valmis tuntilista vanhan nimen alla.

Tuotun tiedoston puuttuminen: tuonti sulauttaa puhelimen päivät tiedostoon eikä koskaan korvaa puhelimella olevaa versiota ilman erillistä vahvistusta. Tämä on tarkoituksellista, jotta puhelimelle jääneet päivät eivät katoa, mutta se jätti kaksi aitoa vikaa. Ajolistan tuonnissa käyttöliittymä ei siirtynyt tuodun listan jaksolle, joten eri kuukauden tiedostoa tuotaessa näkymään jäi vanha kuukausi. Ja kun mitään päivää ei voitu tuoda, käyttäjä ei saanut mitään tietoa siitä, mihin tiedostoon hän on päätynyt.

Nyt tuonnin jälkeen käyttöliittymä siirtyy tuodun listan jaksolle, käyttöliittymä kertoo suoraan, jos tiedosto oli puhelimen version kanssa samankaltainen eikä mitään muutettu, ja tuodulle tiedostolle on oma painike **Käytä tuotua tiedostoa**, jolla sen ottaa käyttöön sellaisenaan. Aiempi versio varmuuskopioidaan ensin. Tämä on nyt ainoa tapa, jolla tuotu tiedosto syrjäyttää puhelimen version, ja se vaatii yhden napsautuksen.

Ajolistan tiedoston nimi kertoo jakson, jonka päivät lista sisältää: päivät 1–15 ovat `1-2` ja päivät 16–30 ovat `2-2`, ja kumpikin puolisko on oma tiedostonsa. Tämä nimi on ollut oikea alusta asti, eikä siinä ollut mitään korjattavaa. Kahdessa testissä oli kuitenkin väärä odutus, koska testipäivät osuivat kuukauden ensimmäiselle puoliskolle, jolloin molemmat nimet näyttivät toimivan. Nyt testit tarkistavat erikseen molemmat puoliskot sekä sen että olemassa oleva tiedosto löytyy kummalta tahansa päivältä.

Samalla korjattiin umpikujalle johtanut virheilmoitus. Kun tiedosto on keskeneräinen tai vieras, ohjelma kertoo nyt mitä tiedostoa ei voitu lukea, eikä raakaa kirjaston englanninkielistä virhettä näy käyttäjälle. Lukukelvoton tiedosto ei enää jää ohjelman ainoaksi lähteeksi eikä sitä kirjoiteta päälle, ja vanha puhelimelle jäänut kopio käytetään sen sijaan. Ohjelman oma tallennus on todennettu oikealla ajolistalla: peräkkäiset tallennukset, auton lisäys ja uudelleenluku onnistuvat. Uuden `2-2`-listan luonti tyhjästä ja kolme peräkkäistä päivää onnistuvat samoin, ja jokainen tiedoston osa jäsentyy. Siksi vika on tiedostossa, joka on tullut puhelimeen ohjelman ulkopuolelta, eikä ohjelman tuottamassa tiedostossa.

Testattu: koko testisarja (19 testiä) ajetaan yhdellä komennolla `npm test`, joka rakentaa sovelluksen ensin ja tarkistaa myös uuden service workerin. Selaintestit on ajettu oikeilla esimerkkilistoilla: koko kirjauspolku selaimessa, vanhan nimellä löytyvä valmis tuntilista, tuodun tiedoston käyttöönotto sekä tuotantobuildi, jossa kirjataan uusi päivä, ladataan XLSX ja sovellus avataan uudelleen yhteyttä katkaistessa. Lähdekoodipaketista on erikseen varmennettu, että `npm ci` ja `npm test` toimivat tuoreesta puretusta paketista ja tuottavat saman versionumeron.

Päivitys: pura ZIP ja lataa sen tiedostot GitHub-repositorion juureen korvaten samannimiset. Avaa päivitys verkkoyhteydessä ja sulje vanhat sovellusikkunat. Asetuksissa näkyy versio 2.11.0. Paikalliset kirjaukset ja asetukset säilyvät.

---

## Versio 2.10 – paikallinen ajolista: tuonti, päiväylehtiö ja omat auton osiot (25.9.2026)

Muutos: Google Drive on jäädytetty pois sovelluksen käyttöliittymästä ja kirjauspolusta. Ajolista avataan, tallennetaan ja muokataan yhtenä paikallisena tiedostona, eikä minkään päivän avaaminen enää tarvitse verkkoyhteyttä. Drive-kirjaston koodi sekä `drive-settings.tsx` on jätetty paikalleen, joten synkronointi voidaan ottaa myöhemmin uudelleen käyttöön. Ajoneuvoasetusten ikkunasta poistettiin nappi, joka ohjasi Driveen: se vaatii kirjautumisen, eikä Driveen voi tällä hetkellä kirjautua.

Ajolistalle on nyt tuonti, aivan kuten tuntilistalle. Ensimmäinen tuonti säilyttää tuodun tiedoston tavumuiseen asti, joten valmis laskutuslista ei muutu tuonnin vuoksi. Myöhemmät tuonnit yhdistävät päivät auton rekisterin ja päivämäärän mukaan: puhelimella itse lisätyt päivät säilyvät, identtiset päivät ohitetaan ja erilainen päivä **raportoidaan eikä korvata** ilman erillistä "Korvaa puhelimen kirjaukset" -vahvistusta. Sama koskee tuntilistaa.

Uusi "Listan kaikki päivät" -näkymä näyttää koko tiedoston päivät yhdessä. Ajolistalla jokaisen päivän kohdalla näkyy auton rekisteri, koska rekisteri on pääavain: sama päivä eri autolla on oma kirjauksensa. Päivän valinta avaa sen tiedot muokattavaksi. Jos tiedostoa ei ole, näkymä tarjoaa tyhjän listan luomisen käyttäjän valitsemalla jaksolla.

Auton, jota listassa ei ole, kirjaaminen ei enää jää kuolleeseen kulmaan. Tallennus ilmoittaa, että autolla ei ole omaa osiota, ja tarjoaa napin, joka lisää sille oman `AUTO:`-osion ajolistan viimeiseksi. Uuteen osioon kopioituvat otsikot sekä päivä-, päästö- ja summakaavat, joten myöhempi päivien haku ja yhteenveto toimivat kuten vanhoissa osioissa. Aiemmat osiot eivät muutu, eikä sama rekisteri voi saata kahta osiota.

Välitetty lisäksi: tuntemattoman auton kohdalla päivän avaaminen kaatui aiemmin kokonaan, vaikka kyseessä oli vain kirjaamaton päivä. Nyt puuttuva auto tulkitaan kirjaamattomaksi päiväksi.

Testattu: uudet testit ajolistan tuonnille (tavumuiseen säilyvä ensimmäinen tuonti, muuttumaton uusintuonti, puhelimen omien päivien säilyminen, ristiriidan raportointi ja vahvistettu korvaus, vanhan version varmuuskopio, tuntilistan hylkäys) ja osion luonnille (omat otsikot ja kaavat, päivän tallennus ja luku takaisin, vanhojen osioiden muuttumattomuus, kahden osion torjunta), olemassa oleva koko TypeScript- ja XLSX-testisarja. Esimerkkilistat luetaan kansiosta `Listat`. Varmistamatta: oikea Google-tili, koska Drive on jäädytetty eikä sitä enää kutsuta.

Päivitys: pura ZIP ja lataa sen tiedostot GitHub-repositorion juureen korvaten samannimiset. Avaa päivitys verkkoyhteydessä ja sulje vanhat sovellusikkunat. Asetuksissa näkyy versio 2.10. Paikalliset kirjaukset ja asetukset säilyvät.

---

## Versio 2.9 – tuonnin virheilmoitus kertoo syyn (25.9.2026)

Korjattu syy: versio 2.8 ilmoitti puoliksi täytetyistä päivistä vain päivämäärän ja sanoi, että ne "eivät täytä tuntilistan vaatimuksia". Päivämäärä yksin ei kerro mitä puuttuu, eikä sen perusteella voi korjata tiedostoa. Tuntilistaan saa tarkoituksella myös keskeneräisiä päivärivejä, joten pelkkä päivämäärä ei ole virhe.

Nyt ilmoitus nimeää puuttuvat kohdat päivän kohdalla, esimerkiksi "23.9. (Täytä tämä kohta.)", ja kertoo mihin tiedostoon ne pitää täydentää. Luettelo on rajattu viiteen päivään, jotta viesti pysyy luettavana, ja lopussa kerrotaan lukumäärä lopuista.

Kaksi tavallisinta syytä, jotka kannattaa tarkistaa tiedostosta: päivärivi, jossa on vain päivämäärä ja muut kentät ovat tyhjä, sekä reittirivi, joka ei ole muodossa `Reitti: ENR-210 | Turku – Salo`. Jälkimmäisestä sovellus ei voi päätellä auton rekisterinumeroa, joten päivää ei tuoda, mutta muut päivät tuodaan normaalisti.

Testattu: puolitäytetty päivä lasketaan päiväksi, se raportoidaan syyn kera eikä sitä kirjoiteta, ja muu lista tuodaan ennallaan. Koko TypeScript- ja XLSX-testisarja.

Päivitys: pura ZIP ja lataa sen tiedostot GitHub-repositorion juureen korvaten samannimiset. Avaa päivitys verkkoyhteydessä ja sulje vanhat sovellusikkunat. Asetuksissa näkyy versio 2.9.

---

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
- `Tuntilista Ajuri.xlsx`: 28 päiväriviä, kolme sairauspäivää ja aloitettu työpäivä maaliskuussa 2025. Vanha hours.xlsx-testikopio on SHA-256-tarkistuksella sama tiedosto. Käyttäjä vahvisti rakenteen nykyiseksi; vanhoja kirjauksia ei käytetä uuden kuukausilistan sisältönä.
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

Valitse lisäksi alkuperäiset kaksi listapohjaa: tuntilistaan **Tuntilista Ajuri.xlsx** ja Pamarkiin yrityksen alkuperäinen Pamark-pohja. Kun painat **Luo puuttuvat listat ja aloita**, sovellus luo automaattisesti puuttuvan tämän kuukauden tuntilistan ja kuluvan puolikuukauden Pamark-listan. Asetukset → **Tallennuskansio ja listapohjat** vaihtaa tallennuspaikan myöhemmin.

## Päivittäinen käyttö

1. Valitse **Tunnit** tai **Pamark ajolista**.
2. Täytä kysymykset. Päivämäärä on automaattinen ja muutettavissa. Voit jatkaa myöhemmin ja vaihtaa listojen välillä.
3. Paina **Tallenna puhelimeen**. Tämä ei ota Google-yhteyttä eikä lähetä tietoja verkkoon.
4. Avaa **Tallennetut listat**, kun haluat viedä XLSX-kopion puhelimen Tiedostot-sovellukseen tai latauksiin. Sovellusmuisti ja Tiedostot-kansio ovat eri asioita.
5. Päivän lopussa avaa **Synkronoi Pamark Driveen** ja paina **Synkronoi**. Tuntilistaa ei lähetetä Driveen.

Esimerkit: 15.9.2026 → `Pamark ajolista syyskuu 1-2 2026.xlsx`; 21.9.2026 → `Pamark ajolista syyskuu 2-2 2026.xlsx`. Jakso määräytyy kirjauksen päivämäärästä.

## Tiedostojen nimeäminen

- **Tuntilista:** `Tuntilista <etunimi><kk><vvv>.xlsx`, esimerkiksi `Tuntilista Testi0926.xlsx`. Nimi alkaa sanalla "Tuntilista", jota seuraa välilyönti. Aiemmissa versioissa erotin oli alaviiva (`Tuntilista_Teemu0926.xlsx`) ja vielä vanhemmassa nimessä oli koko kuljettajan nimi ja kuukausi sanana. Molemmat vanhat nimet löytyvät edelleen ja siirretään uuteen nimeen kirjauksen yhteydessä: sisältö kopioidaan uuteen nimeen ja vanha talletettu nimi poistetaan, joten sama kuukausi ei näy listassa kahteen kertaan. Kansioon tallennetun vanhan tiedoston sisältöä käytetään, mutta vanhaa tiedostoa itseään ei poisteta. Jos saman etunimen tiedosto kuuluu eri kuljettajalle, sitä ei korvata.
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

Erillinen lähdekoodipaketti on muokkaamista varten. Siinä `npm ci` ja `npm run build` muodostavat julkaistavan `dist`-kansion. `npm test` rakentaa sovelluksen ja ajaa koko testisarjan. Käyttäjän ei tarvitse asentaa Nodea tai suorittaa näitä komentoja. Valmis Pages-ZIP sisältää jo koostetun sovelluksen.

Testipohjat luodaan pakettia purettaessa alkuperäisistä esimerkkilistoista kansioon `Listat`, joten testit tarvitsevat ne olemassa oleviksi. Ne on siis kopioitava mukaan, jos testejä haluaa ajaa.

Selaintestit (`tests/browser-flow.mjs`, `tests/browser-legacy.mjs`, `tests/browser-offline.mjs`) eivät kuulu `npm test`iin, koska ne tarvitsevat käynnissä olevan palvelimen. Käynnistä `npm run dev` (selaintestit), aja `tests/browser-flow.mjs` ja `tests/browser-legacy.mjs` ympäristöllä `BASE_URL=http://127.0.0.1:5173`, ja aja `npm run build` sekä `npm run preview` (portti 5175) ennen `tests/browser-offline.mjs`:ää.
