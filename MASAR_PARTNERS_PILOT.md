# MASAR Partners — oplevering en pilotchecklist

## Status

De implementatie staat in deze workspace en de Expo-preview en ontwikkeldienst starten. Dit is nog **geen geactiveerde live pilot**: de broncode-export bevatte geen verbinding met de oorspronkelijke MASAR-accountservice, database of uploads. Er is geen nieuwe vervangende live accountservice aangemaakt.

De oorspronkelijke accountservice is bereikbaar en staat publieke e-mail/wachtwoordregistratie toe. Een gecontroleerde browsertest van een koppeling met de bestaande publieke clientidentiteit en accountproxy gaf echter HTTP 400: de productie-accountservice weigert het domein van deze ontwikkelpreview. De niet-werkende testconfiguratie is verwijderd. Er zijn geen accounts aangemaakt, wachtwoorden gewijzigd, serversecrets gekopieerd of domeinbeperkingen omzeild. De nieuwe partnerroute op de oorspronkelijke API gaf bovendien HTTP 404.

De native client is voorbereid met de actuele Clerk Core 3-aanmeld-, verificatie- en wachtwoordherstelfuncties. Koppel hem in het oorspronkelijke MASAR-project aan een ondersteunde native/testconfiguratie. De proxyconfiguratie wordt daar door de beheerde omgeving geleverd; het handmatig kopiëren van productieconfiguratie naar een ander previewdomein is geen werkende oplossing.

## Gebouwd

- Aparte native React Native/Expo/TypeScript-app voor Android en iOS, zonder WebView.
- Arabisch/RTL standaard; Engels omschakelbaar en opgeslagen.
- Persoonlijke registratie/inloggen via Clerk en beveiligde native tokenopslag.
- Bedrijfsregistratie, profiel, diensten, openingstijden, werkgebied en beschikbaarheid.
- Beoordelingsstatussen, bevoegde bedrijfsgoedkeuring en servergestuurde rolcontroles.
- Eigenaar, planner en werknemer; werknemers krijgen uitsluitend toegewezen opdrachten.
- Gerichte aanbiedingen met reactietermijn; accepteren, weigeren, uitvoering en geschiedenis.
- Onafhankelijke werknemertoewijzing zonder onbedoelde voortgangswijziging.
- Garage-/reparatie-uitvoering zonder verplichte onderweg-stap.
- Opgeslagen concepten per account/bedrijf; fout- en verouderingsmeldingen; geen lokale schijnacceptatie.
- Persistente logo/foto/documentuploads, bevestiging na upload en afgeschermde verificatiedocumenten.
- Native apparaatregistratie, opdrachtlinks uit meldingen, niet-gevoelige pushinhoud, duurzame serverwachtrij en ontvangstcontrole.
- Ontkoppeling van geregistreerde apparaten vóór bevestigd uitloggen; bij verbindingsfalen blijft de fout zichtbaar en moet de gebruiker opnieuw proberen.
- Servergestuurd verlopen van onbeantwoorde aanbiedingen; geaccepteerde opdrachten worden niet automatisch herverdeeld.
- Centrale `roadside_requests` blijven de bron van klantvoortgang; atomische controles en een unieke actieve bedrijfstoewijzing.
- Bedrijfsbeoordeling, geschikte bedrijfsselectie en logboek in mobiele operatoromgeving en bestaande webbeheeromgeving.
- Publieke klantenlijst bevat alleen echt geregistreerde, goedgekeurde actieve bedrijven. Geen verzonnen beoordelingen of certificeringen.

## Daadwerkelijk gecontroleerd

- Typecontrole van gedeelde bibliotheken, API, klantenwebapp en native app.
- Expo-versiecontrole en Expo Doctor: 21 controles geslaagd.
- Bouwen en prerenderen van de geïmporteerde klantenwebapp.
- Vier beleidscontroles voor rollen/werknemersbereik, geschiktheid, statusovergangen/verloop en verouderde updates.
- Vijf ontwikkeldatabasecontroles: geen dubbele actieve bedrijfstoewijzing, lidmaatschap beperkt tot eigen bedrijf, één winnaar bij gelijktijdige versiegebonden acceptatie, geen wijziging met verouderde versie en geen verlopen van een geaccepteerde opdracht.
- Testfixtures worden na de databasetest verwijderd.
- API-health en lege echte publieke partnerlijst: HTTP 200.
- Beschermde API zonder accountconfiguratie: expliciet HTTP 503, geen demo-account of toegangscontrole-omzeiling.
- Arabisch welkomstscherm in de Expo-webpreview.
- Oorspronkelijke accountproxy: HTTP 200; publieke accountinstellingen staan e-mail/wachtwoord en publieke registratie toe. Nieuwe partnerroute op de oorspronkelijke service: HTTP 404.
- Browsercontrole van de remote productie-aanmelding: SDK-bestanden laden, maar client-/environmentinitialisatie wordt geweigerd met HTTP 400 wegens het andere previewdomein. Er zijn geen aanmeld-/registratiepogingen met accountgegevens ingediend. Deze test bewijst niets over een geconfigureerde fysieke native build.

De databasecontroles testen transacties en databasebeperkingen, niet een volledige ingelogde klant-operator-partnerketen. Een geslaagde build is geen bewijs dat alle oorspronkelijke klantenstromen in productie regressievrij zijn.

## Nog nodig voor een echte pilot

1. Neem de API-, schema-, contract- en webwijzigingen over in het **oorspronkelijke centrale MASAR-project**. Bekijk de schemawijzigingen en maak vóór productiegebruik een back-up. Publicatie/migratie uitsluitend na bevestiging.
2. Koppel de native app aan dezelfde accountservice en API als dat project, in een passend testmilieu. Maak geen nieuw onafhankelijk gebruikersbestand. Bevoegde operatorrollen blijven serverbeheerde accountmetadata.
3. Gebruik de bestaande oorspronkelijke opslag of configureer private App Storage in de centrale service. De opslag die hier is ingericht kopieert geen bestaande klantbestanden.
4. Het door de gebruiker opgegeven Expo-project `@ahmedobaji/masar` is lokaal gekoppeld via de opgegeven Project ID. De gebruiker heeft `com.masar.partners` goedgekeurd voor zowel Android als iOS. Configureer nu de bijbehorende signing- en pushcredentials; beschikbaarheid bij Apple/Google is nog niet gecontroleerd.
5. Maak een echte native ontwikkel-/interne testbuild met pushcredentials en test die op fysieke Android- en iOS-apparaten.

### Configuratie

| Onderdeel | Waarden | Waar |
|---|---|---|
| Mobiele API | `EXPO_PUBLIC_API_URL` | HTTPS **server-origin zonder `/api`**; gegenereerde paden voegen `/api` toe |
| Mobiele accounts | `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Publieke sleutel van dezelfde bestaande accountomgeving |
| Native push | `extra.eas.projectId` in `app.json`; optioneel `EXPO_PUBLIC_EAS_PROJECT_ID` | Geconfigureerde EAS-projectidentiteit; een expliciete omgevingswaarde heeft voorrang |
| Centrale API-auth | `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` | Uitsluitend serverconfiguratie van de bestaande accountomgeving |
| Centrale database | `DATABASE_URL` | Bestaande centrale configuratie; nooit opnemen in mobiele app |
| Bestanden | `PRIVATE_OBJECT_DIR` | Private serveropslag |
| Push in ontwikkeling | `MASAR_PARTNER_PUSH_ENABLED=true` | Alleen in een geconfigureerde native testomgeving |

Sleutels en credentials worden via de veilige configuratie-/secretsflow beheerd, nooit via chat of een broncode-ZIP. Ontwikkel- en productieaccounts niet ongemerkt mengen.

### Interne native buildvoorbereiding

- `eas.json` bevat uitsluitend het profiel `preview`: interne distributie, preview-omgeving, remote signingcredentials, Android APK en fysieke iOS-build (geen simulator).
- De Expo-koppeling gaf geen builds terug voor het opgegeven project. Er zijn geen builds gestart of credentials aangemaakt/gecontroleerd.
- De beschikbare Expo-buildfunctie vereist een aan het Expo-project gekoppelde GitHub-repository. Deze workspace heeft nog geen GitHub-remote; het juiste repository en de buildreferentie moeten worden vastgesteld voordat een build wordt gestart.
- Voor een installeerbare interne iPhone-build zijn Apple Developer-signing en een geregistreerd testtoestel in het provisioningprofiel nodig. Android vereist signing en FCM; iOS vereist ook APNs voor push.
- De centrale account-/API-koppeling ontbreekt nog. Een interne build alleen kan daarom geen geslaagde aanmelding, echte opdrachten of gesloten-app-push bewijzen.

### Pilotproeven na configuratie

- Registreer een eigenaar en een bedrijf; bevestig dat vóór goedkeuring geen aanbiedingen of geverifieerde publieke vermelding mogelijk zijn.
- Keur als operator goed; laat de eigenaar beschikbaarheid kiezen.
- Voeg bestaande persoonlijke accounts toe als planner/werknemer. Controleer dat zij zichzelf niet tot eigenaar/operator kunnen promoveren en geen andere bedrijfsgegevens zien.
- Dien als echte testklant een aanvraag in, bied die aan een passend bedrijf aan, accepteer/weiger en verwerk de volledige voortgang.
- Controleer dezelfde voortgang in klantenwebapp, operatoromgeving en native app.
- Controleer gelijktijdige beslissingen, dubbele verzending, verouderde versies, weigering, verval en heraanbieding. Neem operatorbeheer over zonder bedrijf/voortgang/reactietermijn te wijzigen.
- Test goedgekeurd bedrijf blokkeren vóór acceptatie; een oud aanbod mag niet alsnog worden geaccepteerd.
- Test slechte verbinding, app herstart, conceptbehoud, opnieuw verbinden en serverbevestiging van acties.
- Upload/open documenten als eigenaar/operator en bevestig dat onbevoegden geen toegang hebben.
- Test gesloten app, achtergrond, push-toestemming geweigerd, opdrachtlink, notificatievoorkeuren en ontkoppeling bij uitloggen.
- Voer regressieproeven uit op bestaande klantregistratie, voertuigen, bankbevestigde abonnementen en individuele hulpverlenertoewijzing.

## Distributie

- Android: configureer eigen package-ID, Android-pushcredentials, interne native testbuild en daarna onder bevestiging een ondertekende Play Store-build. Vul de actuele privacy-/dataveiligheidsinformatie in.
- iOS: configureer eigen bundle-ID, Apple-ontwikkelaarsaccount, signing en APNs. Test intern/TestFlight en bereid onder bevestiging App Store-informatie en privacyverklaringen voor.
- Bestaande voorwaarden, bankgegevens en bedrijfsdocumenten zijn niet vervangen of verzonnen.
- Er is niets gepubliceerd of bij Apple/Google ingediend.

Technische beheerinformatie: `artifacts/api-server/PARTNER_OPERATIONS.md`.