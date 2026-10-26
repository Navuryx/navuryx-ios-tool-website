# Navuryx iOS Tool Website & PC Link Portal

Official web portal and live PC link bridge for **Navuryx iOS Tool**.

Deployed to: **https://navuryx-ios-tool.vercel.app**

## Features
- **PC Link Web Portal:** Connect your browser directly to your local Navuryx PC phone store over encrypted tunnels.
- **Dynamic QR Code Pairing:** Point your iPhone camera at the screen to immediately pair with Navuryx Store (`navuryx://pair?url=...`).
- **Web IPA Uploader:** Drop any `.ipa` file into the web portal to send it to your PC for signing with your personal Apple ID.
- **Over-The-Air (OTA) Installs:** 1-tap `itms-services://` installation directly on paired iOS devices.
- **Downloads & Live Container Guide:** Access downloads for Windows GUI and iOS IPAs (Store, Container, Tor Browser).

## Deployment on Vercel
1. Import this repository into Vercel.
2. Ensure the project name is set to `navuryx-ios-tool` so Vercel allocates the domain `navuryx-ios-tool.vercel.app`.
3. Framework preset: **Other** / Static.
4. Deploy!
