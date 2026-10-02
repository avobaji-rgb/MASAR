# MASAR-broncode voor de native partnerapp

Deze ZIP is een broncode-export van de bestaande MASAR-klantenapp en centrale API. Er zijn geen database-inhoud, .env-bestanden, sleutels, sessies, klantuploads, privéprojectnotities, Git-geschiedenis of geïnstalleerde dependencies opgenomen. Testbestanden en buildoutput zijn niet opgenomen. Publieke MASAR-logo’s en websitefoto’s zijn wel opgenomen.

## Belangrijkste bestanden
- artifacts/masar-mobility-syria/: bestaande React-klantenwebapp en publieke huisstijlassets.
- artifacts/api-server/: Express API, authenticatie, profielen, abonnementen en dispatch.
- lib/api-spec/openapi.yaml: API-contract.
- lib/api-client-react/ en lib/api-zod/: gegenereerde clients en validatie.
- lib/db/src/schema/: Drizzle-databaseschema, geen opgeslagen klantgegevens.
- lib/integrations-openai-ai-server/: bestaande gedeelde serverbibliotheek.
- package.json, pnpm-workspace.yaml en pnpm-lock.yaml: workspaceconfiguratie.

## Gepubliceerde bestaande service
Website: https://masar-mobility-syria.com
API-basispad: https://masar-mobility-syria.com/api
Dit zijn publieke adressen, geen credentials. De broncode-export bevat de huidige ontwikkelcode; controleer welke API-versie daadwerkelijk gepubliceerd is.

## Opdracht aan de ontvangende agent
Onderzoek deze code voordat je MASAR Partners als aparte native React Native/Expo-app bouwt. Geen PWA of WebView-wrapper. Behoud de bestaande klantenwebapp en de centrale server als bron van waarheid.

Een broncodekopie maakt GEEN automatische verbinding met de bestaande database of authenticatietenant. Gebruik de bestaande centrale API voor gedeelde opdrachten. Maak geen tweede losstaande live database of nieuwe losstaande accountservice als vervanging. Stem mobiele authenticatie af op de bestaande accountservice via de veilige configuratieflows; deel geen backend-secrets via een ZIP of chat.

Zakelijke bedrijven, teamrollen, verificatie, bedrijfsdiensten, bedrijfstoewijzing en echte native push zijn nog te bouwen. Bestaande providers zijn individuele, handmatig geverifieerde accounts. Browsermeldingen zijn geen native push. Nieuwe bedrijfs-API’s moeten ook in de oorspronkelijke centrale backend worden ingevoerd en gepubliceerd voordat ze voor beide apps live beschikbaar zijn.

Voer geen imports van klantdata, destructieve schemawijzigingen, scripts die tabellen overschrijven of productiepublicatie uit zonder toestemming. Houd ontwikkel-/testdata gescheiden van echte klantdata.

Omvang en bestandssommen staan in EXPORT_MANIFEST.json. Replit-artifactmanifesten en omgevingsconfiguratie zijn bewust weggelaten: configureer de ontvangende workspace op basis van de package-scripts en de gekozen architectuur.
