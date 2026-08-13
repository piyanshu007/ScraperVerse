# Hackathon Compliance

This document tracks how WebPulse AI satisfies the official requirements of the **“Into the Scrape-Verse”** hackathon by WeMakeDevs & Bright Data.

| Official Requirement | Source | How WebPulse AI satisfies it | Status |
| :--- | :--- | :--- | :--- |
| **Use Bright Data Scraper Studio** | Hackathon Rules | Implements a robust `BrightDataAdapter` that interacts with Scraper Studio's trigger (`POST /dca/trigger`) and dataset retrieval (`GET /dca/dataset`) APIs. Supports passing dynamic extraction selectors via trigger input. | 🟢 Planned |
| **Self-Healing Capabilities** | Hackathon Theme | Implements a true self-healing loop: detects missing/invalid data, analyzes structural changes between V1/V2 DOM, generates and tests candidate selectors, validates against the schema, and saves the corrected selectors for subsequent runs. | 🟢 Planned |
| **Publicly Available Web Data Only** | Hackathon Rules | Specifically accesses public pages or simulated public pages; does not access paywalls, private user data, or login-protected resources. | 🟢 Planned |
| **Web Application** | Hackathon Rules | Built as a full-stack Next.js web application with a premium SaaS-style landing page and dashboard. | 🟢 Planned |
| **Reproducibility** | Hackathon Theme / Strategy | Fully self-contained local controlled demo environment (Version 1 and Version 2 sources), automated tests, and clear README guidelines so judges can run and verify the self-healing workflow in seconds. | 🟢 Planned |
| **No Hardcoded/Fake Self-Healing** | Custom Guidelines | Implements real HTML analysis (V1 vs V2), candidate generation using schema constraints, and scores candidates based on validation rules rather than pre-programmed hardcoded selector fallbacks. | 🟢 Planned |
| **Security of Credentials** | Best Practices | API keys for Bright Data and AI providers are loaded through secure `.env` variables; template provided in `.env.example`. | 🟢 Planned |
