import "dotenv/config"; // jest runs outside main.ts's bootstrap, so nothing else loads .env for it — same fix as apps/api/test/jest-e2e-setup.ts
